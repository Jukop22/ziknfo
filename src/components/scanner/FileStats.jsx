import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileAudio, BarChart3, Clock, HardDrive } from "lucide-react";

export default function FileStats({ files }) {
  const getTotalSize = () => {
    return files.reduce((total, file) => total + (file.size || 0), 0);
  };

  const getTotalDuration = () => {
    return files.reduce((total, file) => total + (file.length || 0), 0);
  };

  const getFormatCounts = () => {
    const counts = {};
    files.forEach(file => {
      counts[file.format] = (counts[file.format] || 0) + 1;
    });
    return counts;
  };

  const getAverageBitrate = () => {
    if (files.length === 0) return 0;
    const totalBitrate = files.reduce((total, file) => total + (file.bitrate || 0), 0);
    return Math.round(totalBitrate / files.length);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatCounts = getFormatCounts();

  return (
    <div className="space-y-6">
      <Card className="glass-effect border-slate-600">
        <CardHeader className="border-b border-slate-700">
          <CardTitle className="flex items-center gap-3 text-white">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <FileAudio className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Fichiers total</p>
                <p className="text-2xl font-bold text-white">{files.length}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <HardDrive className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Poids total</p>
                <p className="text-2xl font-bold text-white">{formatFileSize(getTotalSize())}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Durée totale</p>
                <p className="text-2xl font-bold text-white">{formatDuration(getTotalDuration())}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-slate-400 mb-2">Bitrate moyen</p>
              <p className="text-xl font-bold text-white">{getAverageBitrate()} kbps</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-effect border-slate-600">
        <CardHeader className="border-b border-slate-700">
          <CardTitle className="text-white">Format</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-3">
            {Object.entries(formatCounts).map(([format, count]) => (
              <div key={format} className="flex items-center justify-between">
                <span className="text-slate-300">{format}</span>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${(count / files.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-white font-medium text-sm">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}