
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle }
  from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Upload, Music, FileAudio, AlertCircle, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

import FileList from "../components/scanner/FileList";
import FileStats from "../components/scanner/FileStats";
import { MetadataExtractor } from "../components/metadata/MetadataExtractor";

export default function Scanner() {
  const [files, setFiles] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const supportedFormats = ['.mp3', '.flac', '.wav', '.m4a', '.dff'];

  // Générer un ID unique pour l'utilisateur basé sur les caractéristiques du navigateur
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
    
    // Créer un hash simple du fingerprint
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  };

  const userId = getUserId();
  const storageKey = `audioFiles_${userId}`;
  const nfoStorageKey = `nfoContent_${userId}`;
  const metadataStorageKey = `albumMetadata_${userId}`;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  };

  const handleFileInput = (e) => {
    const selectedFiles = Array.from(e.target.files);
    processFiles(selectedFiles);
  };

  const handleReset = () => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer tous les fichiers scannés ? Cette action est irréversible et réinitialisera également le générateur NFO.")) {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(nfoStorageKey);
      localStorage.removeItem(metadataStorageKey);
      setFiles([]);
      setError("✅ Tous les fichiers scannés et les données NFO ont été supprimés.");
    }
  };

  const saveToLocalStorage = (newFiles) => {
    try {
      const existingFiles = JSON.parse(localStorage.getItem(storageKey) || '[]');
      // Concatenate new files with existing ones. Assuming new files don't duplicate existing ones
      // or that new entries are desired even if paths are identical.
      // Sorting by created_date to maintain most recent first.
      const allFiles = [...newFiles, ...existingFiles].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      localStorage.setItem(storageKey, JSON.stringify(allFiles));
      return allFiles;
    } catch (error) {
      console.error('Erreur sauvegarde localStorage:', error);
      // Return existing files or an empty array to prevent data loss or inconsistent state.
      return JSON.parse(localStorage.getItem(storageKey) || '[]');
    }
  };

  const loadFromLocalStorage = () => {
    try {
      const savedFiles = JSON.parse(localStorage.getItem(storageKey) || '[]');
      console.log('Fichiers chargés depuis localStorage:', savedFiles.length);
      // Sort by created_date to match previous behavior of AudioFile.list('-created_date')
      return savedFiles.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    } catch (error) {
      console.error('Erreur chargement localStorage:', error);
      return [];
    }
  };

  const processFiles = async (fileList) => {
    setScanning(true);
    setError(null);
    setProgress(0);

    try {
      const audioFiles = fileList.filter(file => {
        const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        return supportedFormats.includes(ext);
      });

      if (audioFiles.length === 0) {
        setError("Aucun fichier audio compatible trouvé. Veuillez sélectionner des fichiers MP3, MPC, APE, FLAC, DFF ou similaires.");
        setScanning(false);
        return;
      }

      console.log(`Traitement de ${audioFiles.length} fichier(s)...`);
      const processedFiles = [];
      
      for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i];
        setProgress(((i + 1) / audioFiles.length) * 100);

        try {
          console.log(`Extraction métadonnées: ${file.name}`);
          // Extraction des vraies métadonnées du fichier
          const metadata = await MetadataExtractor.extractMetadata(file);
          
          const audioFileData = {
            ...metadata,
            filepath: `local://${file.name}`,
            folder_path: "/",
            id: Date.now() + Math.random(), // ID unique pour localStorage
            created_date: new Date().toISOString()
          };

          console.log('Métadonnées extraites:', { 
            filename: file.name,
            format: metadata.format,
            artist: metadata.artist, 
            album: metadata.album, 
            title: metadata.title, 
            length: metadata.length, 
            bitrate: metadata.bitrate 
          });
          
          // Add to processedFiles array instead of saving to DB
          processedFiles.push(audioFileData);
        } catch (fileError) {
          console.error(`Erreur lors du traitement de ${file.name}:`, fileError);
        }
      }

      // Sauvegarder dans localStorage au lieu de la base de données
      const allFiles = saveToLocalStorage(processedFiles);
      setFiles(allFiles);
      
      // Message de succès
      if (processedFiles.length > 0) {
        setError(`✅ ${processedFiles.length} fichier(s) traité(s) avec succès ! Vous pouvez maintenant générer des fichiers NFO.`);
        console.log(`${processedFiles.length} fichier(s) sauvegardé(s) en localStorage`);
      }
    } catch (error) {
      setError("Erreur lors du traitement des fichiers. Veuillez réessayer.");
      console.error('Erreur globale:', error);
    }

    setScanning(false);
    setProgress(0);
  };

  const loadExistingFiles = () => {
    const existingFiles = loadFromLocalStorage();
    setFiles(existingFiles);
  };

  React.useEffect(() => {
    loadExistingFiles();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-3">Scanner de fichiers audio</h1>
            <p className="text-slate-400 text-lg">
              Analysez vos fichiers audio localement pour extraire les métadonnées
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={scanning}
            className="bg-red-800/50 hover:bg-red-800/80 border border-red-500/30 text-red-300"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remise à zéro
          </Button>
        </div>

        {error && (
          <Alert variant={error.startsWith('✅') ? "success" : "destructive"} className={`mb-6 ${error.startsWith('✅') ? "bg-green-900/20 border-green-500/30" : "bg-red-900/20 border-red-500/30"}`}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className={`${error.startsWith('✅') ? "text-green-200" : "text-red-200"}`}>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <Card className="glass-effect border-slate-600">
              <CardHeader className="border-b border-slate-700">
                <CardTitle className="flex items-center gap-3 text-white">
                  <FolderOpen className="w-6 h-6 text-blue-400" />
                  Analyse des fichiers
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div
                  className={`relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 ${
                    dragActive
                      ? "border-blue-400 bg-blue-500/10"
                      : "border-slate-600 hover:border-slate-500"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={supportedFormats.join(',')}
                    onChange={handleFileInput}
                    className="hidden"
                  />

                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <Music className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">
                      Déposez vos fichiers audio ici
                    </h3>
                    <p className="text-slate-400 mb-3 text-lg">
                      Analyse rapide et locale - Aucun téléchargement requis
                    </p>
                    <p className="text-slate-500 mb-6">
                      ou cliquez pour séléectionner vos fichiers
                    </p>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                      disabled={scanning}
                    >
                      <Upload className="w-5 h-5 mr-2" />
                      Parcourir les fichiers
                    </Button>

                    <div className="flex flex-wrap justify-center gap-2 mt-6">
                      {supportedFormats.map((format) => (
                        <Badge key={format} variant="secondary" className="bg-slate-700 text-slate-300">
                          {format.toUpperCase().replace('.', '')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {scanning && (
                  <div className="mt-6 p-6 bg-slate-800/50 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <FileAudio className="w-5 h-5 text-blue-400 animate-pulse" />
                      <span className="text-white font-medium">Analyse en cours...</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <p className="text-sm text-slate-400 mt-2">{Math.round(progress)}% terminé</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <FileStats files={files} />
          </div>
        </div>

        {files.length > 0 && (
          <FileList files={files} />
        )}
      </div>
    </div>
  );
}
