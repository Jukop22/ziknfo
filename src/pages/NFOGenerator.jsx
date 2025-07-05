
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FileText, Download, Copy, Check, Album, Disc, Edit3 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

export default function NFOGenerator() {
  const [files, setFiles] = useState([]);
  const [albums, setAlbums] = useState({});
  const [selectedAlbumKey, setSelectedAlbumKey] = useState(null);
  const [nfoContent, setNfoContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // State pour métadonnées manuelles par album
  const [albumMetadata, setAlbumMetadata] = useState({});
  const [showManualForm, setShowManualForm] = useState({});
  
  // Nouveau state pour mémoriser les NFO générés
  const [savedNfos, setSavedNfos] = useState({});

  // Même système d'ID utilisateur que dans Scanner
  const getUserId = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Browser fingerprint', 2, 2);
    
    const fingerprint = canvas.toDataURL() + 
                       navigator.userAgent + 
                       navigator.language + 
                       screen.width + 'x' + screen.height +
                       new Date().getTimezoneOffset();
    
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  };

  const userId = getUserId();
  const storageKey = `audioFiles_${userId}`;
  const nfoStorageKey = `nfoContent_${userId}`;
  const metadataStorageKey = `albumMetadata_${userId}`;

  useEffect(() => {
    loadFiles();
    loadSavedData();
  }, []);
  
  useEffect(() => {
    const grouped = files.reduce((acc, file) => {
      const cleanArtist = (file.artist || 'Unknown Artist').replace(/[\x00-\x1F\x7F-\x9F]/g, '').replace(/\s+/g, ' ').trim();
      const cleanAlbum = (file.album || 'Unknown Album').replace(/[\x00-\x1F\x7F-\x9F]/g, '').replace(/\s+/g, ' ').trim();
      
      const artistForGrouping = (file.album_artist || cleanArtist).replace(/[\x00-\x1F\x7F-\x9F]/g, '').replace(/\s+/g, ' ').trim();
      
      let key;
      if (!artistForGrouping || artistForGrouping === 'Unknown Artist' || !cleanAlbum || cleanAlbum === 'Unknown Album') {
        key = 'Pistes sans métadonnées';
      } else {
        key = `${artistForGrouping} - ${cleanAlbum}`;
      }
      
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(file);
      return acc;
    }, {});
    
    // Tri des pistes dans chaque album
    for (const key in grouped) {
      if (key !== 'Pistes sans métadonnées') {
        const hasVinylNaming = grouped[key].some(f => f.filename && /^[A-Z]\d+/.test(f.filename));
        
        if (hasVinylNaming) {
          grouped[key].sort((a, b) => {
            const aMatch = a.filename.match(/^([A-Z])(\d+)/);
            const bMatch = b.filename.match(/^([A-Z])(\d+)/);
            
            if (aMatch && bMatch) {
              const [, aSide, aTrack] = aMatch;
              const [, bSide, bTrack] = bMatch;
              
              if (aSide !== bSide) {
                return aSide.localeCompare(bSide);
              }
              return parseInt(aTrack, 10) - parseInt(bTrack, 10);
            }
            return a.filename.localeCompare(b.filename);
          });
        } else {
          grouped[key].sort((a, b) => (a.disc_number || 1) - (b.disc_number || 1) || (a.track_number || 0) - (b.track_number || 0));
        }
      } else {
        grouped[key].sort((a, b) => (a.filename || a.title || '').localeCompare(b.filename || b.title || ''));
      }
    }

    setAlbums(grouped);
    
    // Initialiser métadonnées pour chaque album
    const newAlbumMetadata = { ...albumMetadata };
    const newShowManualForm = { ...showManualForm };
    
    Object.keys(grouped).forEach(albumKey => {
      if (!newAlbumMetadata[albumKey]) {
        const firstFile = grouped[albumKey][0];
        newAlbumMetadata[albumKey] = {
          artist: albumKey === 'Pistes sans métadonnées' ? '' : (firstFile.album_artist || firstFile.artist || ''),
          album: albumKey === 'Pistes sans métadonnées' ? '' : (firstFile.album || ''),
          genre: firstFile.genre || '',
          year: firstFile.year || new Date().getFullYear()
        };
      }
      
      if (newShowManualForm[albumKey] === undefined) {
        newShowManualForm[albumKey] = false;
      }
    });
    
    setAlbumMetadata(newAlbumMetadata);
    setShowManualForm(newShowManualForm);
    setIsLoading(false);
  }, [files]);

  const loadFiles = () => {
    setIsLoading(true);
    try {
      const audioFiles = JSON.parse(localStorage.getItem(storageKey) || '[]');
      audioFiles.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setFiles(audioFiles);
    } catch (error) {
      console.error('Erreur lors du chargement des fichiers:', error);
      setFiles([]);
    }
    setIsLoading(false);
  };

  const loadSavedData = () => {
    try {
      const savedNfoData = JSON.parse(localStorage.getItem(nfoStorageKey) || '{}');
      const savedMetadata = JSON.parse(localStorage.getItem(metadataStorageKey) || '{}');
      setSavedNfos(savedNfoData);
      setAlbumMetadata(savedMetadata);
    } catch (error) {
      console.error('Erreur chargement données sauvegardées:', error);
    }
  };

  const saveToLocalStorage = () => {
    try {
      localStorage.setItem(nfoStorageKey, JSON.stringify(savedNfos));
      localStorage.setItem(metadataStorageKey, JSON.stringify(albumMetadata));
    } catch (error) {
      console.error('Erreur sauvegarde localStorage:', error);
    }
  };

  const formatFileSize = (bytes, useMiB = false) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = useMiB ? ['Bytes', 'KiB', 'MiB', 'GiB'] : ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds, forTotal = false) => {
    if (forTotal) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return [
            h > 0 ? h.toString().padStart(2, '0') : null,
            m.toString().padStart(2, '0'),
            s.toString().padStart(2, '0')
        ].filter(Boolean).join(':');
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `[${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}]`;
  };

  const pad = (label, value, width = 35) => {
    const padding = '.'.repeat(Math.max(0, width - label.length));
    return `${label}${padding}: ${value}`;
  }

  const formatWritingLibrary = (library) => {
    if (!library || library === 'Unknown') return 'Unknown';
    return library
      .replace(/^reference\s+/, '')
      .replace(/(\d{4})(\d{2})(\d{2})$/, '($1-$2-$3)');
  };

  const generateNFO = () => {
    if (!selectedAlbumKey || !albums[selectedAlbumKey]) {
      setNfoContent("Veuillez sélectionner un album valide pour générer un fichier NFO.");
      return;
    }

    const filesToProcess = albums[selectedAlbumKey];
    if (filesToProcess.length === 0) return;

    const firstFile = filesToProcess[0];
    const totalSize = filesToProcess.reduce((sum, f) => sum + f.size, 0);
    const totalDuration = filesToProcess.reduce((sum, f) => sum + f.length, 0);
    
    // Utiliser métadonnées manuelles ou celles du fichier
    const currentMetadata = albumMetadata[selectedAlbumKey] || {};
    const albumArtist = currentMetadata.artist || firstFile.album_artist || firstFile.artist || 'Unknown Artist';
    const albumName = currentMetadata.album || firstFile.album || 'Unknown Album';
    const albumGenre = currentMetadata.genre || firstFile.genre || 'Unknown';
    const albumYear = currentMetadata.year || firstFile.year || new Date().getFullYear();

    const skullAscii = `                      
                         @@              
                       @@@@           
                @@@@@@ @@@@@@        @
@@@           @@@@@@@@@@@@@@@      @@@
@@@@@        @@@@@@@@@@@@@@@@    @@@@@
@@@@@@     @@@@@@@@@@@@@@@@@@   @@@@@@
@@@@@@@   @@@@@@@@@@@@@@@@@@@ @@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @@@@@@@ 
 @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 
  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@  
   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@   
    @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@    
    @@@@@@   @@@@@@@@@@@@    @@@@@    
   @@@@@@     @@@@@@@@@@      @@@@@   
   @@@@@  @@@  @@@@@@@@@ @@@  @@@@@@  
   @@@@@ @@@@@ @@@@@@@@@@@@@@ @@@@@   
    @@@@ @@@@@@@@@@@@@@@@@@@@ @@@@    
     @@@@@@@@@@@@ @@  @@@@@@@@@@@     
      @@@@@@@@@  @@@@@ @@@@@@@@@      
        @@@@@    @@@@     @@@@@       

`;

    const titleAscii = `   _____ _                                            _     _   _ ______ ____  
  / ____| |                                          | |   | \\ | |  ____/ __ \\ 
 | (___ | |__   __ _ _ __ _____      _____   ___   __| |   |  \\| | |__ | |  | |
  \\___ \\| '_ \\ / _\` | '__/ _ \\ \\ /\\ / / _ \\ / _ \\ / _\` |   | . \` |  __|| |  | |
  ____) | | | | (_| | | |  __/\\ V | V /(_) | (_) | (_| |   | |\\  | |   | |__| |
 |_____/|_| |_|\\__,_|_|  \\___| \\_/\\_/ \\___/ \\___/ \\__,_|   |_| \\_|_|    \\____/ 

`;

    let nfo = skullAscii;
    nfo += titleAscii;
    nfo += `---------------------------------------------------------------------------------\n`;
    
    // Centrer le titre de l'album
    const albumTitle = `${albumArtist} - ${albumName}`;
    const padding = Math.max(0, Math.floor((81 - albumTitle.length) / 2));
    const centeredTitle = ' '.repeat(padding) + albumTitle;
    nfo += `${centeredTitle}\n`;
    nfo += `---------------------------------------------------------------------------------\n\n`;

    if (albumArtist && albumArtist !== 'Unknown Artist') nfo += `${pad('Artiste', albumArtist)}\n`;
    if (albumName && albumName !== 'Unknown Album') nfo += `${pad('Album', albumName)}\n`;
    if (albumGenre && albumGenre !== 'Unknown') nfo += `${pad('Genre(s)', albumGenre)}\n`;
    if (albumYear) nfo += `${pad('Année', albumYear)}\n\n`;

    if (firstFile.format && firstFile.format !== 'Unknown') nfo += `${pad('Codec', firstFile.format)}\n`;
    if (firstFile.bitrate) nfo += `${pad('Bitrate global', `${firstFile.bitrate} kb/s`)}\n`;
    if (firstFile.bitrate_mode && firstFile.bitrate_mode !== 'Unknown') nfo += `${pad('Bit rate mode', firstFile.bitrate_mode)}\n`;

    let channelInfo;
    const channels = firstFile.channels;
    const samplerate = firstFile.samplerate;
    const bitsPerSample = firstFile.bits_per_sample;

    if (channels && samplerate) {
        if (firstFile.format === 'DFF' || firstFile.format === 'DSF') {
            let dsdRateLabel = '';
            if (samplerate === 2822400) dsdRateLabel = 'DSD64 (2.8 MHz)';
            else if (samplerate === 5644800) dsdRateLabel = 'DSD128 (5.6 MHz)';
            else if (samplerate === 11289600) dsdRateLabel = 'DSD256 (11.3 MHz)';
            else if (samplerate === 22579200) dsdRateLabel = 'DSD512 (22.6 MHz)';
            else dsdRateLabel = `${Math.round(samplerate / 1_000_000)} MHz`;
            channelInfo = `${channels} channels / ${dsdRateLabel}`;
        } else {
            const formattedSampleRate = Math.round(samplerate / 1000).toLocaleString('fr-FR');
            if (bitsPerSample) {
                channelInfo = `${channels} channels / ${formattedSampleRate} kHz / ${bitsPerSample} bits`;
            } else {
                channelInfo = `${channels} channels / ${formattedSampleRate} kHz`;
            }
        }
        if (channelInfo) nfo += `${pad('Channel', channelInfo)}\n`;
    }

    if (firstFile.quality && firstFile.quality !== 'Unknown') nfo += `${pad('Qualité', firstFile.quality)}\n`;
    
    if (firstFile.writing_library && firstFile.writing_library !== 'Unknown') {
        nfo += `${pad('Encodage', formatWritingLibrary(firstFile.writing_library))}\n`;
    }
    
    if (firstFile.encoding_settings && firstFile.encoding_settings !== 'Unknown') {
        nfo += `${pad('Parametres', firstFile.encoding_settings)}\n`;
    }

    // Ajouter un espacement après le bloc d'infos
    nfo += `\n\n`;

    nfo += `---------------------------------------------------------------------------------\n`;
    nfo += `                                 Pistes de l'album\n`;
    nfo += `---------------------------------------------------------------------------------\n`;

    const isMultiDisc = filesToProcess.some(f => (f.disc_number || 1) > 1);
    const isVinyl = filesToProcess.some(f => f.filename && /^[A-Z]\d+/.test(f.filename));
    let currentDisc = 0;
    let currentSide = '';

    filesToProcess.forEach((file, index) => {
      const discNum = file.disc_number || 1;
      
      if (isVinyl) {
        const vinylMatch = file.filename.match(/^([A-Z])(\d+)/);
        if (vinylMatch) {
          const side = vinylMatch[1];
          const trackNum = parseInt(vinylMatch[2], 10);
          
          if (side !== currentSide) {
            currentSide = side;
            nfo += `\n                                    Face ${side}\n`;
            nfo += `---------------------------------------------------------------------------------\n`;
          }
          
          const artistName = file.artist && file.artist !== 'Unknown Artist' ? file.artist : albumArtist;
          const trackTitle = file.title && file.title !== file.filename ? file.title : file.filename.replace(/\.[^/.]+$/, "");
          
          const fullTrackTitle = `${side}${String(trackNum).padStart(2, '0')}. ${artistName} - ${trackTitle}`;
          const trackInfo = `[${file.bitrate || 0} kb/s] [${formatFileSize(file.size, true)}] ${formatDuration(file.length)}`;
          
          const maxTitleWidth = 79 - trackInfo.length;
          let displayTitle = fullTrackTitle;

          if (displayTitle.length > maxTitleWidth) {
            displayTitle = displayTitle.substring(0, maxTitleWidth - 4) + '... ';
          }
          
          const paddedTitle = displayTitle.padEnd(maxTitleWidth, ' ');
          nfo += `${paddedTitle}${trackInfo}\n`;
        }
      } else {
        if (isMultiDisc && discNum !== currentDisc) {
          currentDisc = discNum;
          nfo += `\n                                      CD ${currentDisc}\n`;
          nfo += `---------------------------------------------------------------------------------\n`;
        }
        
        const trackNumber = selectedAlbumKey === 'Pistes sans métadonnées' ? (index + 1) : (file.track_number || index + 1);
        
        const trackPrefix = isMultiDisc 
          ? `${discNum}-${String(trackNumber).padStart(2, '0')}`
          : String(trackNumber).padStart(2, '0');

        const artistName = file.artist && file.artist !== 'Unknown Artist' ? file.artist : albumArtist;
        const trackTitle = file.title && file.title !== file.filename ? file.title : file.filename.replace(/\.[^/.]+$/, "");
        
        const fullTrackTitle = `${trackPrefix}. ${artistName} - ${trackTitle}`;
        const trackInfo = `[${file.bitrate || 0} kb/s] [${formatFileSize(file.size, true)}] ${formatDuration(file.length)}`;
        
        const maxTitleWidth = 79 - trackInfo.length;
        let displayTitle = fullTrackTitle;

        if (displayTitle.length > maxTitleWidth) {
          displayTitle = displayTitle.substring(0, maxTitleWidth - 4) + '... ';
        }
        
        const paddedTitle = displayTitle.padEnd(maxTitleWidth, ' ');
        nfo += `${paddedTitle}${trackInfo}\n`;
      }
    });

    nfo += `\n\n`;
    nfo += `${pad('Durée totale', formatDuration(totalDuration, true))}\n`;
    nfo += `${pad('Poids total', formatFileSize(totalSize))}\n`;

    setNfoContent(nfo);
    
    // CORRECTION: Sauvegarder immédiatement le NFO généré
    const newSavedNfos = {
      ...savedNfos,
      [selectedAlbumKey]: nfo
    };
    setSavedNfos(newSavedNfos);
    // Sauvegarder immédiatement dans localStorage
    try {
      localStorage.setItem(nfoStorageKey, JSON.stringify(newSavedNfos));
    } catch (error) {
      console.error('Erreur sauvegarde NFO généré:', error);
    }
  };

  // Fonction appelée quand on change d'album sélectionné
  const handleAlbumChange = (albumKey) => {
    // Sauvegarder les modifications actuelles si il y en a
    if (selectedAlbumKey && nfoContent && nfoContent !== savedNfos[selectedAlbumKey]) {
      setSavedNfos(prev => ({
        ...prev,
        [selectedAlbumKey]: nfoContent
      }));
      saveToLocalStorage(); // Save current NFO state when switching albums
    }
    
    setSelectedAlbumKey(albumKey);
    
    // Charger le NFO sauvegardé pour ce nouvel album
    if (savedNfos[albumKey]) {
      setNfoContent(savedNfos[albumKey]);
    } else {
      setNfoContent("");
    }
  };

  const handleMetadataChange = (albumKey, field, value) => {
    const newMetadata = {
      ...albumMetadata,
      [albumKey]: {
        ...albumMetadata[albumKey],
        [field]: value
      }
    };
    setAlbumMetadata(newMetadata);
    // Call saveToLocalStorage after state update, or consider batching if performance is an issue
    // For now, let's keep it simple and save on each change.
    const newSavedNfos = { ...savedNfos }; // Trigger save for albumMetadata as well
    localStorage.setItem(nfoStorageKey, JSON.stringify(newSavedNfos));
    localStorage.setItem(metadataStorageKey, JSON.stringify(newMetadata));
  };

  const toggleManualForm = (albumKey) => {
    setShowManualForm(prev => ({
      ...prev,
      [albumKey]: !prev[albumKey]
    }));
  };

  const downloadNFO = () => {
    if (!nfoContent) return;
    const blob = new Blob([nfoContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const currentMetadata = albumMetadata[selectedAlbumKey] || {};
    const filename = currentMetadata.album || selectedAlbumKey || 'Ungrouped Tracks';
    a.download = `${filename}.nfo`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    if (!nfoContent) return;
    try {
      await navigator.clipboard.writeText(nfoContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleReset = () => {
    setNfoContent("");
    setSelectedAlbumKey(null);
    setCopied(false);
    setSavedNfos({});
    setAlbumMetadata({});
    setShowManualForm({});
    localStorage.removeItem(nfoStorageKey);
    localStorage.removeItem(metadataStorageKey);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex flex-col">
      <div className="max-w-7xl mx-auto flex flex-col flex-grow w-full">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-3">Générateur de NFO</h1>
          <p className="text-slate-400 text-lg">
            Génération des fichiers NFO
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 flex-grow min-h-0">
          <Card className="glass-effect border-slate-600 flex flex-col">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="flex items-center gap-3 text-white">
                <Album className="w-6 h-6 text-blue-400" />
                Albums Scannés ({Object.keys(albums).length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex-grow overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-8">
                  <Disc className="w-16 h-16 text-slate-600 mx-auto mb-4 animate-spin [animation-duration:3s]" />
                  <p className="text-slate-400">Chargement des fichiers...</p>
                </div>
              ) : Object.keys(albums).length === 0 ? (
                <div className="text-center py-8">
                  <Disc className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Aucun album trouvé. Veuillez d'abord scanner des fichiers sur la page Scanner.</p>
                  <Button
                    variant="outline"
                    className="mt-4 border-slate-600 text-slate-300 hover:bg-slate-700"
                    onClick={() => window.location.href = '/Scanner'}
                  >
                    Aller au Scanner
                  </Button>
                </div>
              ) : (
                <Accordion type="single" collapsible value={selectedAlbumKey} onValueChange={handleAlbumChange}>
                  {Object.entries(albums).map(([key, tracks]) => (
                    <AccordionItem value={key} key={key} className="border-b-slate-700">
                      <AccordionTrigger className="p-4 rounded-lg hover:bg-slate-700/50">
                        <div className="text-left flex-1">
                          {key === 'Pistes sans métadonnées' ? (
                            <h3 className="font-semibold text-lg text-white">Pistes sans métadonnées</h3>
                          ) : (
                            <>
                              <h3 className="font-semibold text-lg text-white">{albumMetadata[key]?.album || tracks[0].album}</h3>
                              <p className="text-slate-400">{albumMetadata[key]?.artist || tracks[0].artist}</p>
                            </>
                          )}
                          <p className="text-xs text-slate-500 mt-1">{tracks.length} pistes</p>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-4 bg-slate-800/50">
                        {/* Formulaire manuel pour tous les albums */}
                        <div className="mb-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-white font-medium flex items-center gap-2">
                              <Edit3 className="w-4 h-4" />
                              Informations de l'album
                            </h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleManualForm(key)}
                              className="text-slate-300 hover:text-white"
                            >
                              {showManualForm[key] ? 'Masquer' : 'Modifier'}
                            </Button>
                          </div>
                          {showManualForm[key] && (
                            <div className="space-y-3">
                              <Input
                                type="text"
                                placeholder="Nom de l'artiste"
                                value={albumMetadata[key]?.artist || ''}
                                onChange={(e) => handleMetadataChange(key, 'artist', e.target.value)}
                                className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                              />
                              <Input
                                type="text"
                                placeholder="Nom de l'album"
                                value={albumMetadata[key]?.album || ''}
                                onChange={(e) => handleMetadataChange(key, 'album', e.target.value)}
                                className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                              />
                              <div className="grid grid-cols-2 gap-3">
                                <Input
                                  type="text"
                                  placeholder="Genre"
                                  value={albumMetadata[key]?.genre || ''}
                                  onChange={(e) => handleMetadataChange(key, 'genre', e.target.value)}
                                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                                />
                                <Input
                                  type="number"
                                  placeholder="Année"
                                  value={albumMetadata[key]?.year || ''}
                                  onChange={(e) => handleMetadataChange(key, 'year', parseInt(e.target.value) || new Date().getFullYear())}
                                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <ul className="space-y-2">
                          {tracks.map(track => (
                            <li key={track.id} className="text-sm text-slate-300 flex justify-between">
                              {key === 'Pistes sans métadonnées' ? (
                                  <span>{track.artist && track.artist !== 'Unknown Artist' ? `${track.artist} - ` : ''}{track.title || track.filename}</span>
                                ) : (
                                  <span>{String(track.track_number || '').padStart(2, '0')}. {track.title}</span>
                                )}
                              <span className="text-slate-500">{formatDuration(track.length)}</span>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>

          <Card className="glass-effect border-slate-600 flex flex-col">
            <CardHeader className="border-b border-slate-700">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-white">
                  <FileText className="w-6 h-6 text-blue-400" />
                  Aperçu NFO
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={generateNFO}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    disabled={!selectedAlbumKey}
                  >
                    Générer
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    disabled={!selectedAlbumKey && !nfoContent}
                  >
                    Réinitialiser
                  </Button>
                  {nfoContent && (
                    <>
                      <Button
                        variant="outline" size="icon" onClick={copyToClipboard}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="outline" size="icon" onClick={downloadNFO}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 flex-grow flex flex-col">
              <Textarea
                value={nfoContent}
                onChange={(e) => {
                  setNfoContent(e.target.value);
                  if (selectedAlbumKey) {
                    setSavedNfos(prev => ({
                      ...prev,
                      [selectedAlbumKey]: e.target.value
                    }));
                    saveToLocalStorage(); // Save NFO content immediately as user types
                  }
                }}
                placeholder="Le contenu NFO apparaîtra ici après la génération..."
                className="flex-grow font-mono text-xs bg-slate-800/50 border-slate-600 text-slate-300 resize-none"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
