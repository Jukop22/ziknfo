
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileAudio, Clock, HardDrive } from "lucide-react";

export default function FileList({ files }) {
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatWritingLibrary = (library) => {
    if (!library || library === 'Unknown') return 'Unknown';
    return library
      .replace(/^reference\s+/, '')
      .replace(/(\d{4})(\d{2})(\d{2})$/, '($1-$2-$3)');
  };

  const getFormatColor = (format) => {
    const colors = {
      'MP3': 'bg-red-500/20 text-red-300 border-red-500/30',
      'FLAC': 'bg-green-500/20 text-green-300 border-green-500/30',
      'WAV': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      'APE': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      'DFF': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'M4A': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      'ALAC': 'bg-orange-500/20 text-orange-300 border-orange-500/30'
    };
    return colors[format] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  };

  return (
    <Card className="glass-effect border-slate-600">
      <CardHeader className="border-b border-slate-700">
        <CardTitle className="flex items-center gap-3 text-white">
          <FileAudio className="w-6 h-6 text-blue-400" />
          Fichiers scannés ({files.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="p-6 rounded-xl border border-slate-600 bg-slate-800/30 hover:bg-slate-800/50 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-white text-lg mb-2">{file.filename}</h3>
                  <div className="flex items-center gap-3 mb-3">
                    <Badge className={`${getFormatColor(file.format)} border`}>
                      {file.format}
                    </Badge>
                    {file.writing_library && file.writing_library !== "Unknown" ? (
                      <span className="text-sm text-slate-400">{formatWritingLibrary(file.writing_library)}</span>
                    ) : (
                      file.version && file.version !== 'N/A' && (
                        <span className="text-sm text-slate-400">{file.version}</span>
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-slate-400">Poids</p>
                    <p className="font-medium text-white">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-slate-400">Durée</p>
                    <p className="font-medium text-white">{formatDuration(file.length)}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-slate-400">Bitrate</p>
                  <p className="font-medium text-white">{file.bitrate} kbps</p>
                </div>
                
                <div>
                  <p className="text-slate-400">Sample Rate</p>
                  <p className="font-medium text-white">{file.samplerate} Hz</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Mode: <span className="text-white">{file.mode}</span></span>
                  {file.format !== 'DFF' && ( // Conditional rendering for 'Bits' field
                    <span className="text-slate-400">Bits: <span className="text-white">{file.bits_per_sample || 16}</span></span>
                  )}
                  <span className="text-slate-400 truncate ml-4">Path: <span className="text-white">{file.folder_path}</span></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
