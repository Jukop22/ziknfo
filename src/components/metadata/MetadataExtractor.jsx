
// Helper constants for MP3 parsing
const MP3_BIT_RATES = {
    'V1L1': [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    'V1L2': [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    'V1L3': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    'V2L1': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    'V2L2': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    'V2L3': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    'V25L1': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    'V25L2': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    'V25L3': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
};

const MP3_SAMPLE_RATES = {
    'V1': [44100, 48000, 32000],
    'V2': [22050, 24000, 16000],
    'V25': [11025, 12000, 8000]
};

export class MetadataExtractor {

  static async extractMetadata(file) {
    console.log(`[Extractor] Début pour: ${file.name}`);
    const extension = file.name.toLowerCase().split('.').pop();
    const fileBuffer = await file.arrayBuffer();

    let finalMetadata = {
      filename: file.name,
      size: file.size,
      format: extension.toUpperCase(),
      artist: "Unknown Artist",
      album: "Unknown Album",
      title: file.name.replace(/\.[^/.]+$/, ""),
      writing_library: "Unknown",
    };

    switch (extension) {
      case 'mp3':
        Object.assign(finalMetadata, await this.extractMP3Metadata(fileBuffer, file));
        break;
      case 'flac':
        Object.assign(finalMetadata, await this.extractFLACMetadata(fileBuffer, file));
        break;
      case 'dff':
        Object.assign(finalMetadata, await this.extractDFFMetadata(fileBuffer, file));
        break;
      case 'm4a':
      case 'aac':
      case 'alac':
        Object.assign(finalMetadata, await this.extractM4AMetadata(fileBuffer, file));
        break;
      default:
        try {
          const audioProps = await this.extractAudioProperties(file);
          Object.assign(finalMetadata, audioProps);
          console.log(`[Extractor] Web Audio API réussie pour ${file.name}:`, audioProps);
        } catch (e) {
          console.warn(`[Extractor] Format ${extension} non supporté ou Web Audio API échouée.`, e);
        }
    }

    const filenameData = this.extractFromFilename(file.name);
    if (finalMetadata.artist === 'Unknown Artist' && filenameData.artist) finalMetadata.artist = filenameData.artist;
    if (finalMetadata.album === 'Unknown Album' && filenameData.album) finalMetadata.album = filenameData.album;
    if (finalMetadata.title === file.name.replace(/\.[^/.]+$/, "") && filenameData.title) finalMetadata.title = filenameData.title;
    if (!finalMetadata.track_number && filenameData.track_number) finalMetadata.track_number = filenameData.track_number;
    if (!finalMetadata.disc_number && filenameData.disc_number) finalMetadata.disc_number = filenameData.disc_number;
    
    if (!finalMetadata.bitrate && finalMetadata.length > 0 && finalMetadata.size > 0) {
        finalMetadata.bitrate = Math.round((finalMetadata.size * 8) / finalMetadata.length / 1000);
    }
    
    const losslessFormats = ['FLAC', 'ALAC', 'APE', 'WAV', 'AIFF', 'DFF', 'WV'];
    if (losslessFormats.includes(finalMetadata.format)) {
      finalMetadata.quality = 'Lossless';
    } else {
      finalMetadata.quality = 'Lossy';
    }

    console.log(`[Extractor] Terminé pour ${file.name}`, finalMetadata);
    return finalMetadata;
  }

  static async extractAudioProperties(file) {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const reader = new FileReader();
      reader.onload = (e) => {
        audioContext.decodeAudioData(e.target.result)
          .then(buffer => {
            audioContext.close();
            resolve({
              length: Math.round(buffer.duration),
              samplerate: buffer.sampleRate,
              channels: buffer.numberOfChannels,
              mode: buffer.numberOfChannels === 1 ? 'Mono' : 'Stereo',
            });
          })
          .catch(err => { audioContext.close(); reject(err); });
      };
      reader.onerror = (err) => { audioContext.close(); reject(err); };
      reader.readAsArrayBuffer(file);
    });
  }

  static async extractMP3Metadata(buffer, file) {
    let metadata = { format: 'MP3', bitrate_mode: 'Unknown', bits_per_sample: 16 };
    const tagData = await this.extractID3Tags(buffer);
    if (tagData) Object.assign(metadata, tagData);
    
    const startOffset = this.getID3v2TagSize(buffer);
    const mp3Properties = this.parseMP3Header(buffer, startOffset, file.size);
    if (mp3Properties) Object.assign(metadata, mp3Properties);
    
    return metadata;
  }

  static parseMP3Header(buffer, startOffset, fileSize) {
    const view = new DataView(buffer);
    let offset = startOffset;
    
    while(offset < buffer.byteLength - 4) {
      if (view.getUint16(offset, false) >> 5 === 0x7FF) {
        const header = view.getUint32(offset, false);
        const versionId = (header >> 19) & 0x03;
        const layerId = (header >> 17) & 0x03;
        const bitrateIndex = (header >> 12) & 0x0F;
        const sampleRateIndex = (header >> 10) & 0x03;
        const channelMode = (header >> 6) & 0x03;
        
        if (versionId === 1 || layerId === 0 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
            offset++;
            continue;
        }
        
        const version = ['V2.5', 'Reserved', 'V2', 'V1'][versionId];
        const layer = ['Reserved', 'L3', 'L2', 'L1'][layerId];
        
        const samplerate = MP3_SAMPLE_RATES[version][sampleRateIndex];
        const bitrate = MP3_BIT_RATES[`${version}${layer}`][bitrateIndex];
        
        // The info/Xing header is usually located at a fixed offset from the first MP3 audio frame header.
        // For mono: offset + 21 bytes (4 bytes header + 17 bytes for side info, if channelMode is Mono)
        // For stereo: offset + 36 bytes (4 bytes header + 32 bytes for side info, if channelMode is Stereo)
        // This is simplified and might not be accurate for all cases, as frame sizes vary.
        // A more robust approach would be to parse the full frame header.
        // The original code uses a simplified offset for info tag.
        // Let's rely on the scan of extractLameInfo for more robustness.
        
        // For the VBR check, we can use the original logic if it's reliable.
        // It generally looks for 'Xing' or 'Info' tag inside the frame.
        const vbrCheckOffset = offset + 36; // A common location for Xing/Lame header for stereo, or info frame
        const isVBR = (vbrCheckOffset + 8 <= buffer.byteLength && 
                       (view.getUint32(vbrCheckOffset, false) === 0x58696E67 || view.getUint32(vbrCheckOffset, false) === 0x496E666F));
        
        // Chercher les informations LAME en scannant depuis l'offset du début du frame
        const lameInfo = this.extractLameInfo(view, offset);
        
        const audioSize = fileSize - startOffset - (this.getID3v1TagSize(buffer) ? 128 : 0);
        const duration = Math.floor((audioSize * 8) / (bitrate * 1000));
        
        return {
          samplerate,
          bitrate,
          channels: channelMode === 3 ? 1 : 2,
          mode: channelMode === 3 ? 'Mono' : 'Stereo',
          bitrate_mode: isVBR ? 'Variable' : 'Constant',
          length: duration,
          ...lameInfo
        };
      }
      offset++;
    }
    return null;
  }

  static extractLameInfo(view, startOffset) {
    const lameInfo = {};
    
    try {
      // Scanner une zone plus large pour trouver LAME - commencer depuis l'en-tête MP3
      const searchStart = Math.max(0, startOffset - 100);
      const searchEnd = Math.min(view.byteLength - 20, startOffset + 1000);
      
      console.log(`[MP3] Recherche LAME de ${searchStart} à ${searchEnd} (offset start: ${startOffset})`);
      
      for (let i = searchStart; i < searchEnd; i++) {
        // Chercher la signature 'LAME' (0x4C414D45)
        if (i + 20 <= view.byteLength && 
            view.getUint32(i, false) === 0x4C414D45) {
          
          console.log(`[MP3] Signature LAME trouvée à l'offset ${i}`);
          
          // Lire les 20 caractères suivants pour capturer la version complète
          const lameBytes = new Uint8Array(view.buffer, i, 20);
          
          // Trouver la fin de la chaîne (null terminator ou caractère non-ASCII)
          let endIndex = 20;
          for (let j = 0; j < 20; j++) {
            if (lameBytes[j] === 0 || lameBytes[j] > 127) {
              endIndex = j;
              break;
            }
          }
          
          const lameVersion = new TextDecoder('ascii').decode(lameBytes.slice(0, endIndex));
          
          if (lameVersion.startsWith('LAME')) {
            lameInfo.writing_library = lameVersion;
            console.log(`[MP3] Version LAME extraite: "${lameVersion}"`);
            
            // Essayer d'extraire les paramètres d'encodage si disponibles
            // These offsets are relative to the 'LAME' signature
            if (i + 36 <= view.byteLength) {
              try {
                // Approximate position for VBR method and quality flags within the LAME tag
                // This can vary between LAME versions. This is a common heuristic.
                const encodingByte = view.getUint8(i + 27); 
                if (encodingByte !== 0) {
                  const vbrMethod = (encodingByte >> 4) & 0x0F; // Extract VBR method (e.g., ABR, CBR, VBR)
                  const quality = encodingByte & 0x0F;         // Extract VBR quality (0-9 for -V)
                  
                  if (vbrMethod > 0 && quality < 10) { // Check for a valid VBR method and quality
                    lameInfo.encoding_settings = `-V${quality}`;
                  } else if (vbrMethod === 0) { // If VBR method is 0, it might be CBR or ABR
                    // For CBR, 'CBR' might be explicitly set, or bitrate info implies it.
                    // For ABR, it might also have a quality setting or target bitrate.
                    // This is a simplification; full parsing of LAME tag is complex.
                    // For now, only set if it clearly indicates VBR quality.
                  }
                }
              } catch (e) {
                console.warn('[MP3] Impossible d\'extraire les paramètres d\'encodage:', e);
              }
            }
            
            break; // Sortir de la boucle une fois trouvé
          }
        }
      }
      
      // Si rien trouvé avec la méthode principale, essayer une recherche dans les tags ID3
      if (!lameInfo.writing_library) {
        console.log('[MP3] Recherche LAME dans les tags ID3...');
        this.searchLameInID3Tags(view, lameInfo);
      }
      
    } catch (error) {
      console.warn('[MP3] Erreur lors de l\'extraction LAME:', error);
    }
    
    return lameInfo;
  }
  
  static searchLameInID3Tags(view, lameInfo) {
    try {
      // Chercher dans les 2000 premiers octets (zone des tags ID3v2)
      const searchEnd = Math.min(2000, view.byteLength - 10);
      
      for (let i = 0; i < searchEnd; i++) {
        if (view.getUint32(i, false) === 0x4C414D45) { // 'LAME'
          const lameBytes = new Uint8Array(view.buffer, i, Math.min(15, view.byteLength - i));
          
          let endIndex = 15;
          for (let j = 0; j < 15; j++) {
            if (lameBytes[j] === 0 || lameBytes[j] > 127) {
              endIndex = j;
              break;
            }
          }
          
          const lameVersion = new TextDecoder('ascii').decode(lameBytes.slice(0, endIndex));
          if (lameVersion.startsWith('LAME') && lameVersion.length > 4) {
            lameInfo.writing_library = lameVersion;
            console.log(`[MP3] LAME trouvé dans ID3: "${lameVersion}"`);
            break;
          }
        }
      }
    } catch (error) {
      console.warn('[MP3] Erreur recherche LAME dans ID3:', error);
    }
  }

  static async extractFLACMetadata(buffer, file) {
    let metadata = { format: 'FLAC', bitrate_mode: 'Variable' };
    const view = new DataView(buffer);
    if (view.getUint32(0, false) !== 0x664C6143) return metadata;

    let offset = 4;
    while(offset < buffer.byteLength - 4) {
      const blockHeader = view.getUint8(offset);
      const blockType = blockHeader & 0x7F;
      const blockSize = (view.getUint8(offset + 1) << 16) | (view.getUint8(offset + 2) << 8) | view.getUint8(offset + 3);
      
      if(blockSize < 0 || offset + 4 + blockSize > buffer.byteLength) {
        console.warn(`[FLAC] Invalid block size or out of bounds: ${blockSize}`);
        break;
      }

      if (blockType === 0) { // STREAMINFO block
        const streaminfoDataOffset = offset + 4;
        const byte12Offset = streaminfoDataOffset + 12;
        const byte13Offset = streaminfoDataOffset + 13;

        if (byte13Offset >= buffer.byteLength) {
            console.warn('[FLAC] STREAMINFO block is truncated. Cannot read bits_per_sample.');
            break;
        }

        const bitsPerSample = (((view.getUint8(byte12Offset) & 0x01) << 4) | (view.getUint8(byte13Offset) >> 4)) + 1;
        const sampleRate = (view.getUint8(streaminfoDataOffset + 10) << 12) | (view.getUint8(streaminfoDataOffset + 11) << 4) | (view.getUint8(byte12Offset) >> 4);
        const channels = ((view.getUint8(byte12Offset) >> 1) & 0x07) + 1;
        
        const totalSamplesHigh = view.getUint8(byte13Offset) & 0x0F;
        const totalSamplesLow = view.getUint32(streaminfoDataOffset + 14, false);
        const totalSamples = (totalSamplesHigh * 0x100000000) + totalSamplesLow;
        
        Object.assign(metadata, {
          samplerate: sampleRate,
          channels: channels,
          mode: channels === 1 ? 'Mono' : 'Stereo',
          length: Math.floor(totalSamples / sampleRate),
          bits_per_sample: bitsPerSample,
        });
      } else if (blockType === 4) { // VORBIS_COMMENT block
        Object.assign(metadata, this.parseVorbisCommentBlock(new Uint8Array(buffer, offset + 4, blockSize)));
      }
      
      offset += 4 + blockSize;
      if (blockHeader & 0x80) break;
    }
    return metadata;
  }

  static async extractDFFMetadata(buffer, file) {
    let metadata = {
      format: 'DFF',
      bits_per_sample: 1,
      quality: 'Lossless',
      bitrate_mode: 'Constant',
      samplerate: 2822400,
      channels: 2,
      mode: 'Stereo',
      length: 0,
      bitrate: 0,
      version: 'DSD64'
    };

    try {
      const view = new DataView(buffer);
      
      if (buffer.byteLength < 16 || view.getUint32(0, false) !== 0x46524D38 || view.getUint32(12, false) !== 0x44534420) {
        console.warn('[DFF] Signatures invalides');
        return metadata;
      }

      let offset = 16;

      while (offset < buffer.byteLength - 12) {
        const chunkId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
        const chunkSize = Number(view.getBigUint64(offset + 4, false));
        
        if (chunkSize <= 0 || offset + 12 + chunkSize > buffer.byteLength) {
          console.warn(`[DFF] Chunk ${chunkId} invalide, taille: ${chunkSize}`);
          break;
        }

        const chunkDataOffset = offset + 12;

        if (chunkId === 'PROP') {
          this.parseDFFProperties(buffer, chunkDataOffset, chunkSize, metadata);
        } else if (chunkId === 'ID3 ') {
          const id3Buffer = buffer.slice(chunkDataOffset, chunkDataOffset + chunkSize);
          const id3Tags = await this.extractID3Tags(id3Buffer);
          if (id3Tags) Object.assign(metadata, id3Tags);
        }

        let nextOffset = offset + 12 + chunkSize;
        if (nextOffset % 2 !== 0) nextOffset++;
        offset = nextOffset;
      }

      const averageRealBitrate = 4200;
      const audioDataRatio = 0.98;
      
      const effectiveAudioSizeBytes = file.size * audioDataRatio;
      const effectiveAudioSizeKbits = (effectiveAudioSizeBytes * 8) / 1000;
      
      const calculatedDuration = Math.round(effectiveAudioSizeKbits / averageRealBitrate);
      metadata.length = calculatedDuration;
      
      if (calculatedDuration > 0) {
        metadata.bitrate = Math.round((file.size * 8) / (calculatedDuration * 1000));
      }
      
      console.log(`[DFF] Final calculation: ${file.size} bytes, duration: ${metadata.length}s, bitrate: ${metadata.bitrate} kbps`);

    } catch (error) {
      console.error('[DFF] Erreur lors de l\'extraction:', error);
    }

    return metadata;
  }
  
  static parseDFFProperties(buffer, offset, size, metadata) {
    try {
      const view = new DataView(buffer, offset, size);
      if (view.getUint32(0, false) !== 0x534E4420) {
        console.warn('[DFF] Expected "SND " chunk in properties, but not found.');
        return;
      }

      let propOffset = 4;
      while (propOffset < size - 12) {
        const subChunkId = String.fromCharCode(
          view.getUint8(propOffset), view.getUint8(propOffset + 1),
          view.getUint8(propOffset + 2), view.getUint8(propOffset + 3)
        );
        const subChunkSize = Number(view.getBigUint64(propOffset + 4, false));
        const subDataOffset = propOffset + 12;

        if (subDataOffset + subChunkSize > size) {
          console.warn(`[DFF] Sub-chunk ${subChunkId} invalid size or out of bounds. Stopping properties parsing.`);
          break;
        }

        if (subChunkId === 'FS  ' && subChunkSize >= 4) {
          metadata.samplerate = view.getUint32(subDataOffset, false);
          if (metadata.samplerate === 2822400) metadata.version = 'DSD64';
          else if (metadata.samplerate === 5644800) metadata.version = 'DSD128';
          else if (metadata.samplerate === 11289600) metadata.version = 'DSD256';
          else if (metadata.samplerate === 22579200) metadata.version = 'DSD512';
          else metadata.version = `DSD${Math.round(metadata.samplerate / 44100)}`;
          console.log(`[DFF] Samplerate: ${metadata.samplerate}, Version: ${metadata.version}`);
        } else if (subChunkId === 'CHNL' && subChunkSize >= 2) {
          metadata.channels = view.getUint16(subDataOffset, false);
          metadata.mode = metadata.channels === 1 ? 'Mono' : 'Stereo';
          console.log(`[DFF] Channels: ${metadata.channels}, Mode: ${metadata.mode}`);
        }

        let advance = 12 + subChunkSize;
        if (advance % 2 !== 0) advance++;
        propOffset += advance;
      }
    } catch (error) {
      console.warn('[DFF] Error parsing DFF properties:', error);
    }
  }

  static async extractM4AMetadata(buffer, file) {
    let metadata = { format: 'M4A' };
    
    console.log(`[M4A] Starting parsing for ${file.name}`);
    const manualParseResult = this.parseMP4File(buffer);
    Object.assign(metadata, manualParseResult);
    console.log(`[M4A] Final metadata for ${file.name}:`, metadata);

    // Le bitrate pour les formats lossless (comme ALAC) est calculé, pas read.
    if (metadata.length > 0 && file.size > 0) {
        if (!metadata.bitrate) { // Ne pas écraser s'il a été trouvé (ex: VBR AAC)
            metadata.bitrate = Math.round((file.size * 8) / metadata.length / 1000);
        }
    }
    
    return metadata;
  }

  static parseMP4File(buffer) {
    const results = {};
    const view = new DataView(buffer);
    this.findAndParseMP4Atoms(view, 0, buffer.byteLength, results);
    return results;
  }
  
  static findAndParseMP4Atoms(view, offset, end, results, depth = 0) {
    if (depth > 10) { // Prevent infinite recursion, though unlikely with well-formed files
      return;
    }

    while (offset < end - 8) { // Ensure there's enough space for size and type
      let size, type;
      try {
        size = view.getUint32(offset, false); // Atom size
        type = String.fromCharCode( // Atom type (e.g., 'moov', 'mdat')
          view.getUint8(offset + 4), view.getUint8(offset + 5),
          view.getUint8(offset + 6), view.getUint8(offset + 7)
        );
      } catch (e) {
        // Handle cases where reading size/type goes out of bounds, indicating corrupted or incomplete data
        return; // Break out of the loop or function if buffer is exhausted
      }

      // Validate atom size and bounds
      if (size === 0 || size < 8 || offset + size > end) {
        // If size is 0, or too small, or extends beyond current parent atom's bounds,
        // it's likely an error or padding. Skip or break.
        // For 'mdat' atom, size 0 means it extends to the end of the file.
        if (type === 'mdat') {
            size = end - offset; // Treat mdat as extending to file end
        } else {
            // Log a warning for other invalid atoms and try to skip to next potential atom
            console.warn(`[M4A] Invalid atom size ${size} for type ${type} at offset ${offset}. Skipping.`);
            offset += 8; // Try to skip past the header
            continue;
        }
      }
      
      console.log(`[MP4] Found atom: ${type}, size: ${size}, offset: ${offset}, depth: ${depth}`);
      
      const atomDataOffset = offset + 8; // Start of atom data
      const atomDataEnd = offset + size; // End of atom data

      switch (type) {
        case 'moov':
        case 'trak':
        case 'mdia':
        case 'minf':
        case 'stbl':
        case 'udta':
          // These are container atoms, recurse into them
          this.findAndParseMP4Atoms(view, atomDataOffset, atomDataEnd, results, depth + 1);
          break;
        
        case 'meta':
          // 'meta' atom often has a 4-byte version/flags field after the header
          // The actual child atoms start at offset + 12
          this.findAndParseMP4Atoms(view, offset + 12, atomDataEnd, results, depth + 1);
          break;

        case 'mdhd': // Media Header Atom - contains timescale and duration
          if (!results.length) { // Only parse if duration not yet found
            // Check for version to read duration/timescale correctly
            // Version 0: 4 bytes creation time, 4 bytes modification time, 4 bytes timescale, 4 bytes duration
            // Version 1: 8 bytes creation time, 8 bytes modification time, 4 bytes timescale, 8 bytes duration
            const mdhdVersion = view.getUint8(atomDataOffset);
            let timescaleOffset, durationOffset;

            if (mdhdVersion === 0) {
                timescaleOffset = atomDataOffset + 12;
                durationOffset = atomDataOffset + 16;
                if (timescaleOffset + 4 > atomDataEnd || durationOffset + 4 > atomDataEnd) break;
                const timescale = view.getUint32(timescaleOffset, false);
                const duration = view.getUint32(durationOffset, false);
                if (timescale > 0) {
                  results.length = Math.round(duration / timescale);
                  console.log(`[MP4] Found duration: ${results.length}s (timescale: ${timescale}, duration: ${duration})`);
                }
            } else if (mdhdVersion === 1) {
                timescaleOffset = atomDataOffset + 20;
                durationOffset = atomDataOffset + 24;
                if (timescaleOffset + 4 > atomDataEnd || durationOffset + 8 > atomDataEnd) break;
                const timescale = view.getUint32(timescaleOffset, false);
                // BigInt for duration for version 1
                const duration = Number(view.getBigUint64(durationOffset, false));
                if (timescale > 0) {
                  results.length = Math.round(duration / timescale);
                  console.log(`[MP4] Found duration: ${results.length}s (timescale: ${timescale}, duration: ${duration})`);
                }
            }
          }
          break;

        case 'stsd': // Sample Description Atom - contains audio properties
          console.log(`[MP4] Processing stsd atom at offset ${offset}`);
          if (!results.samplerate) { // Only parse if samplerate not yet found
            let stsdOffset = atomDataOffset + 8; // Points to first sample entry (skips version, flags, entry_count)
            
            while(stsdOffset < atomDataEnd) {
              const sampleDescSize = view.getUint32(stsdOffset, false); // Size of the sample description entry
              
              if (sampleDescSize < 8 || stsdOffset + sampleDescSize > atomDataEnd) {
                console.warn(`[M4A] Invalid sample description size for type. Breaking.`);
                break;
              }

              // Type of sample description entry (e.g., 'alac', 'mp4a', 'ac-3')
              const sampleDescType = String.fromCharCode(
                  view.getUint8(stsdOffset + 4), view.getUint8(stsdOffset + 5),
                  view.getUint8(stsdOffset + 6), view.getUint8(stsdOffset + 7)
              );
              console.log(`[MP4] Sample description type: ${sampleDescType}, size: ${sampleDescSize}`);

              if (sampleDescType === 'alac') {
                 results.format = 'ALAC';
                 results.quality = 'Lossless';
                 
                 // Look for nested 'alac' configuration atom within this sample entry
                 // ALAC sample entry header is 36 bytes, so nested atoms start after that.
                 let nestedOffset = stsdOffset + 36; 
                 console.log(`[MP4] Looking for nested alac config from offset ${nestedOffset} to ${stsdOffset + sampleDescSize}`);
                 
                 while (nestedOffset < stsdOffset + sampleDescSize - 8) {
                    const nestedAtomSize = view.getUint32(nestedOffset, false);
                    const nestedAtomType = String.fromCharCode(
                        view.getUint8(nestedOffset + 4), view.getUint8(nestedOffset + 5),
                        view.getUint8(nestedOffset + 6), view.getUint8(nestedOffset + 7)
                    );
                    
                    console.log(`[MP4] Nested atom: ${nestedAtomType}, size: ${nestedAtomSize}, offset: ${nestedOffset}`);
                    
                    if (nestedAtomSize < 8 || nestedOffset + nestedAtomSize > stsdOffset + sampleDescSize) {
                        console.log(`[MP4] Invalid nested atom size, breaking nested loop`);
                        break;
                    }
                    
                    if (nestedAtomType === 'alac') {
                        console.log(`[MP4] Found ALAC config atom!`);
                        const configDataOffset = nestedOffset + 12; // Skip atom header + version/flags (4 bytes)
                        
                        if (configDataOffset + 24 <= stsdOffset + sampleDescSize) { // Ensure enough bytes for the main ALAC config
                            // ALAC magic cookie structure interpretation (common offsets for key properties)
                            results.bits_per_sample = view.getUint8(configDataOffset + 5); // Bit depth
                            results.channels = view.getUint8(configDataOffset + 9); // Number of channels
                            results.samplerate = view.getUint32(configDataOffset + 20, false); // Sample rate
                            results.mode = results.channels === 1 ? 'Mono' : 'Stereo';
                            
                            console.log(`[MP4] ALAC config extracted: channels=${results.channels}, samplerate=${results.samplerate}, bits=${results.bits_per_sample}`);
                        }
                        break; // Found ALAC config, exit nested loop
                    }
                    nestedOffset += nestedAtomSize;
                 }
                 break; // Found ALAC sample entry, no need to check other sample types
              } else if (sampleDescType === 'mp4a') {
                 // For mp4a (AAC), common audio properties
                 if (stsdOffset + 28 < atomDataEnd) { // Check if enough bytes for basic mp4a info
                     results.channels = view.getUint16(stsdOffset + 16, false); // Channels
                     results.bits_per_sample = view.getUint16(stsdOffset + 18, false); // Sample size (usually 16)
                     const sampleRateFixedPoint = view.getUint32(stsdOffset + 24, false); // Samplerate fixed point 16.16
                     results.samplerate = sampleRateFixedPoint >>> 16; // Extract integer part
                     results.mode = results.channels === 1 ? 'Mono' : 'Stereo';
                     console.log(`[MP4] MP4A config extracted: channels=${results.channels}, samplerate=${results.samplerate}, bits=${results.bits_per_sample}`);
                 }

                 // Look for 'esds' atom within 'mp4a' to get bitrate (if available)
                 let esdsOffset = this.findAtom(view, 'esds', stsdOffset + 8, stsdOffset + sampleDescSize);
                 if (esdsOffset && (esdsOffset + 24 <= atomDataEnd)) { // Ensure enough bytes for ESDS info
                     let esdsDataOffset = esdsOffset + 8; // Skip 'esds' header (4 bytes size, 4 bytes type)
                     // Skip version (1 byte) and flags (3 bytes)
                     esdsDataOffset += 4;
                     
                     // Find DecoderConfigDescrTag (0x04)
                     if (view.getUint8(esdsDataOffset) === 0x03) { // ES_DescrTag
                        // Skip tag and its size (which can be variable length, but often 1 byte length + 2 bytes ES_ID + 1 byte flags for simple cases)
                        // This parsing is simplified and might not handle all variations of ESDS structure.
                        esdsDataOffset += 1 + view.getUint8(esdsDataOffset + 1); // Skip tag, 1 byte size, size bytes, ES_ID, flags
                        
                        // Try to find 0x04 (DecoderConfigDescrTag)
                        while(esdsDataOffset < atomDataEnd - 13 && view.getUint8(esdsDataOffset) !== 0x04) {
                            esdsDataOffset += 1 + view.getUint8(esdsDataOffset + 1);
                        }

                        if (view.getUint8(esdsDataOffset) === 0x04) { // DecoderConfigDescrTag
                           // Skip tag (1 byte), size (variable), objectTypeIndication (1 byte), streamType (1 byte), bufferSizeDB (3 bytes)
                           esdsDataOffset += 1 + view.getUint8(esdsDataOffset + 1); // Skip tag and its size
                           esdsDataOffset += 1 + 1 + 3; // Skip objectTypeIndication, streamType, bufferSizeDB
                           
                           if (esdsDataOffset + 8 <= atomDataEnd) { // Check if maxBitrate and avgBitrate are present
                               const maxBitrate = view.getUint32(esdsDataOffset, false);
                               const avgBitrate = view.getUint32(esdsDataOffset + 4, false);
                               if (avgBitrate > 0) {
                                   results.bitrate = Math.round(avgBitrate / 1000);
                               } else if (maxBitrate > 0) {
                                   results.bitrate = Math.round(maxBitrate / 1000);
                               }
                               console.log(`[MP4] ESDS Bitrate: max=${maxBitrate}, avg=${avgBitrate}. Calculated: ${results.bitrate} kbps`);
                           }
                        }
                     }
                 }
                 break; // Found mp4a, no need to check other sample types
              }
              stsdOffset += sampleDescSize; // Move to the next sample description entry
            }
          }
          break;
        
        case 'ilst': // Metadata (tags)
          this.parseIlstAtom(view, atomDataOffset, atomDataEnd, results);
          // Don't break, continue looking for other atoms if any.
          // This allows finding other properties like duration or samplerate after tags.
          break;
      }
      offset += size; // Move to the next atom
    }
  }

  static findAtom(view, atomName, startOffset, endOffset) {
      let offset = startOffset;
      while (offset < endOffset - 8) {
          const size = view.getUint32(offset, false);
          if (size < 8 || offset + size > endOffset) break;
          const type = String.fromCharCode.apply(null, new Uint8Array(view.buffer, offset + 4, 4));
          if (type === atomName) {
              return offset;
          }
          offset += size;
      }
      return null;
  }

  static parseIlstAtom(view, offset, end, results) {
    while (offset < end - 8) {
      const size = view.getUint32(offset, false);
      if (size === 0 || size < 8 || offset + size > end) {
        offset += 8;
        continue;
      }

      const type = String.fromCharCode(
          view.getUint8(offset + 4), view.getUint8(offset + 5),
          view.getUint8(offset + 6), view.getUint8(offset + 7)
      );

      const dataAtomOffset = offset + 8;
      if (dataAtomOffset + 8 > offset + size) {
          offset += size;
          continue;
      }

      const dataSize = view.getUint32(dataAtomOffset, false);
      const dataType = String.fromCharCode(
          view.getUint8(dataAtomOffset + 4), view.getUint8(dataAtomOffset + 5),
          view.getUint8(dataAtomOffset + 6), view.getUint8(dataAtomOffset + 7)
      );

      if (dataType === 'data' && dataSize >= 16 && dataAtomOffset + dataSize <= offset + size) {
        const payloadOffset = dataAtomOffset + 16;
        const payloadSize = dataSize - 16;
        
        if (payloadSize < 0 || payloadOffset + payloadSize > view.buffer.byteLength) {
            offset += size;
            continue;
        }

        switch (type) {
            case '©nam':
                try {
                    const text = new TextDecoder('utf-8').decode(new Uint8Array(view.buffer, payloadOffset, payloadSize)).replace(/\0/g, '').trim();
                    if (text) results.title = text;
                } catch (e) {}
                break;
            case '©alb':
                try {
                    const text = new TextDecoder('utf-8').decode(new Uint8Array(view.buffer, payloadOffset, payloadSize)).replace(/\0/g, '').trim();
                    if (text) results.album = text;
                } catch (e) {}
                break;
            case '©ART':
                try {
                    const text = new TextDecoder('utf-8').decode(new Uint8Array(view.buffer, payloadOffset, payloadSize)).replace(/\0/g, '').trim();
                    if (text) results.artist = text;
                } catch (e) {}
                break;
            case 'aART':
                try {
                    const text = new TextDecoder('utf-8').decode(new Uint8Array(view.buffer, payloadOffset, payloadSize)).replace(/\0/g, '').trim();
                    if (text) results.album_artist = text;
                } catch (e) {}
                break;
            case '©gen':
                try {
                    const text = new TextDecoder('utf-8').decode(new Uint8Array(view.buffer, payloadOffset, payloadSize)).replace(/\0/g, '').trim();
                    if (text) results.genre = text;
                } catch (e) {}
                break;
            case '©day':
                try {
                    const text = new TextDecoder('utf-8').decode(new Uint8Array(view.buffer, payloadOffset, payloadSize)).replace(/\0/g, '').trim();
                    const year = parseInt(text.substring(0, 4), 10);
                    if (!isNaN(year)) results.year = year;
                } catch (e) {}
                break;
            case '©too':
                try {
                    const text = new TextDecoder('utf-8').decode(new Uint8Array(view.buffer, payloadOffset, payloadSize)).replace(/\0/g, '').trim();
                    if (text) results.writing_library = text;
                } catch (e) {}
                break;
            case 'trkn':
                if (payloadSize >= 4) {
                    results.track_number = view.getUint16(payloadOffset + 2, false);
                }
                break;
            case 'disk':
                if (payloadSize >= 4) {
                    results.disc_number = view.getUint16(payloadOffset + 2, false);
                }
                break;
        }
      }
      offset += size;
    }
  }

  static getID3v2TagSize(buffer) {
    const view = new Uint8Array(buffer);
    if (view.length < 10 || String.fromCharCode(view[0], view[1], view[2]) !== 'ID3') return 0;
    return ((view[6] << 21) | (view[7] << 14) | (view[8] << 7) | view[9]) + 10;
  }
  
  static getID3v1TagSize(buffer) {
    const view = new Uint8Array(buffer);
    return view.length >= 128 && String.fromCharCode.apply(null, view.slice(view.length - 128, view.length - 125)) === 'TAG';
  }

  static async extractID3Tags(buffer) {
    const view = new DataView(buffer);
    if (buffer.byteLength < 10 || String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2)) !== 'ID3') return null;

    const tagSize = ((view.getUint8(6) << 21) | (view.getUint8(7) << 14) | (view.getUint8(8) << 7) | view.getUint8(9)) + 10;
    const tags = {};
    let offset = 10;
    while (offset < tagSize - 10) {
      if (offset + 10 > buffer.byteLength) break;

      const frameId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
      if (!/^[A-Z0-9]{4}$/.test(frameId)) {
          if (frameId.charCodeAt(0) === 0) break;
          offset++;
          continue;
      }
      
      const frameSize = view.getUint32(offset + 4, false);
      if (frameSize <= 0 || offset + 10 + frameSize > buffer.byteLength) {
        console.warn(`[ID3] Invalid frame size ${frameSize} for frame ${frameId} at offset ${offset}. Breaking.`);
        break;
      }
      
      const frameContentArray = new Uint8Array(buffer, offset + 10, frameSize);
      
      let text = '';
      try {
        const encodingByte = frameContentArray[0];
        let textData = frameContentArray.slice(1);
        let decoder;

        if (encodingByte === 0x00) { // ISO-8859-1
          decoder = new TextDecoder('iso-8859-1');
        } else if (encodingByte === 0x01) { // UTF-16
          // Check for BOM (Byte Order Mark)
          if (textData.length >= 2 && textData[0] === 0xFF && textData[1] === 0xFE) {
              decoder = new TextDecoder('utf-16le');
              textData = textData.slice(2);
          } else if (textData.length >= 2 && textData[0] === 0xFE && textData[1] === 0xFF) {
              decoder = new TextDecoder('utf-16be');
              textData = textData.slice(2);
          } else {
              // Default to little-endian if no BOM
              decoder = new TextDecoder('utf-16le');
          }
        } else if (encodingByte === 0x02) { // UTF-16BE (without BOM)
          decoder = new TextDecoder('utf-16be');
        } else if (encodingByte === 0x03) { // UTF-8
          decoder = new TextDecoder('utf-8');
        } else {
          // Fallback to a common encoding if byte is invalid
          decoder = new TextDecoder('iso-8859-1');
        }

        text = decoder.decode(textData).replace(/\0/g, '');

      } catch (error) {
        console.warn(`[ID3] Error decoding frame ${frameId}:`, error);
        text = '';
      }
      
      if (text) {
        const trimmedText = text.trim();
        switch (frameId) {
          case 'TPE1': tags.artist = trimmedText; break;
          case 'TALB': tags.album = trimmedText; break;
          case 'TIT2': tags.title = trimmedText; break;
          case 'TCON': tags.genre = trimmedText; break;
          case 'TYER': 
          case 'TDRC': 
            const yearMatch = trimmedText.match(/(\d{4})/);
            if (yearMatch) tags.year = parseInt(yearMatch[1], 10);
            break;
          case 'TRCK': 
            const trackMatch = trimmedText.match(/^(\d+)(?:[/](\d+))?/);
            if (trackMatch) tags.track_number = parseInt(trackMatch[1], 10);
            break;
          case 'TPOS': 
            const discMatch = trimmedText.match(/^(\d+)(?:[/](\d+))?/);
            if (discMatch) tags.disc_number = parseInt(discMatch[1], 10);
            break;
          case 'TSSE': tags.writing_library = trimmedText; break;
          case 'TENC':
            if (!tags.writing_library) {
              tags.writing_library = trimmedText;
            }
            break;
          case 'TPE2': tags.album_artist = trimmedText; break;
        }
      }
      offset += 10 + frameSize;
    }
    return tags;
  }

  static parseVorbisCommentBlock(data) {
    const tags = {};
    try {
      let offset = 0;
      if (offset + 4 > data.length) return tags;

      const vendorLength = data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
      offset += 4;
      
      if (offset + vendorLength > data.length) {
          console.warn('[FLAC] Vorbis vendor length out of bounds.');
          return tags;
      }
      
      const vendorString = new TextDecoder('utf-8').decode(data.slice(offset, offset + vendorLength));
      tags.writing_library = vendorString;
      
      offset += vendorLength;

      if (offset + 4 > data.length) return tags;
      const commentCount = data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
      offset += 4;
      
      for (let i = 0; i < commentCount; i++) {
        if (offset + 4 > data.length) {
            console.warn('[FLAC] Vorbis comment length out of bounds.');
            break;
        }
        
        const commentLength = data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
        offset += 4;
        
        if (commentLength < 0 || offset + commentLength > data.length) {
            console.warn('[FLAC] Vorbis comment data out of bounds or negative length.');
            break;
        }
        
        const comment = new TextDecoder('utf-8').decode(data.slice(offset, offset + commentLength));
        const [key, value] = comment.split('=');
        
        if (key && value !== undefined) {
          switch (key.toUpperCase()) {
            case 'ARTIST': tags.artist = value; break;
            case 'ALBUM': tags.album = value; break;
            case 'TITLE': tags.title = value; break;
            case 'GENRE': tags.genre = value; break;
            case 'DATE': 
            case 'YEAR': 
              const year = parseInt(value.substring(0, 4), 10);
              if (!isNaN(year)) tags.year = year;
              break;
            case 'TRACKNUMBER': 
              const track = parseInt(value, 10);
              if (!isNaN(track)) tags.track_number = track;
              break;
            case 'DISCNUMBER': 
              const disc = parseInt(value, 10);
              if (!isNaN(disc)) tags.disc_number = disc;
              break;
            case 'ENCODER': 
            case 'SOFTWARE': 
            case 'ENCODEDBY': 
              tags.writing_library = value; 
              break;
          }
        }
        offset += commentLength;
      }
    } catch (error) {
      console.warn('[FLAC] Error parsing Vorbis Comments block:', error);
    }
    return tags;
  }

  static extractFromFilename(filename) {
    const cleaned = filename.replace(/\.[^/.]+$/, "");
    const result = {};
    
    const vinylMatch = cleaned.match(/^([A-D])(\d+)[-.\s]+(.+?)(?:\s*-\s*(.+))?$/);
    if (vinylMatch) {
      result.disc_number = Math.ceil((vinylMatch[1].charCodeAt(0) - 64) / 2);
      result.track_number = parseInt(vinylMatch[2], 10);
      result.artist = vinylMatch[4] ? vinylMatch[3].trim() : "Unknown Artist";
      result.title = vinylMatch[4] ? vinylMatch[4].trim() : vinylMatch[3].trim();
      return result;
    }

    const standardMatch = cleaned.match(/^(?:(\d+)[-.]?)?(\d+)[-.\s]+(.+?)(?:\s*-\s*(.+))?$/);
    if(standardMatch) {
        if(standardMatch[1]) result.disc_number = parseInt(standardMatch[1], 10);
        result.track_number = parseInt(standardMatch[2], 10);
        
        const possibleArtistTitle = standardMatch[3].trim();
        const possibleTitle = standardMatch[4] ? standardMatch[4].trim() : possibleArtistTitle;

        if (!standardMatch[4] && possibleArtistTitle.includes(' - ')) {
            const parts = possibleArtistTitle.split(' - ');
            result.artist = parts[0].trim();
            result.title = parts.slice(1).join(' - ').trim();
        } else {
            result.artist = standardMatch[4] ? possibleArtistTitle : "Unknown Artist";
            result.title = possibleTitle;
        }
        return result;
    }
    
    result.title = cleaned;
    return result;
  }
}
