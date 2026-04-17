import { useState, useRef } from 'react';
import { UploadCloud, FileArchive, Download, CheckCircle, Loader2 } from 'lucide-react';
import { saveAs } from 'file-saver';
import { processZip } from './lib/builder';

export default function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [resultBlob, setResultBlob] = useState(null);
  const [originalName, setOriginalName] = useState('');
  
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = async (file) => {
    if (!file || !file.name.endsWith('.zip')) {
      alert("Por favor, selecione um arquivo .zip exportado do Notion.");
      return;
    }
    
    setOriginalName(file.name.replace('.zip', ''));
    setIsProcessing(true);
    setProgress(0);
    setCurrentFile('Iniciando processamento...');
    setResultBlob(null);

    try {
      const generatedBlob = await processZip(file, (percent, fileName) => {
        setProgress(Math.round(percent * 100));
        setCurrentFile(`Processando: ${fileName}`);
      });
      
      setResultBlob(generatedBlob);
    } catch (e) {
      console.error(e);
      alert('Erro ao processar o arquivo: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    processFile(file);
  };

  const handleDownload = () => {
    if (resultBlob) {
      saveAs(resultBlob, `${originalName}-html.zip`);
    }
  };

  return (
    <div className="app-wrapper">
      <div className="app-container">
        <header className="header">
          <h1>SENAI Static Generator</h1>
          <p>Arraste o arquivo ZIP exportado do Notion para converter em páginas estáticas estruturadas para o ambiente SENAI.</p>
        </header>

        {!isProcessing && !resultBlob && (
          <div 
            className={`dropzone ${isDragging ? 'active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
          >
            <UploadCloud size={64} className="dropzone-icon" />
            <p>Arraste seu arquivo Notion (.zip) aqui</p>
            <span>ou clique para procurar pelo seu computador</span>
            <input 
              type="file" 
              accept=".zip,application/zip" 
              className="hidden" 
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleFileInput}
            />
          </div>
        )}

        {isProcessing && (
          <div className="progress-container">
            <div className="progress-header">
              <span>Gerando Material Estático...</span>
              <span>{Math.max(1, progress)}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="file-status">
              <Loader2 size={14} className="inline mr-2 animate-spin" style={{ verticalAlign: 'middle', marginRight: '6px' }}/>
              {currentFile}
            </div>
          </div>
        )}

        {resultBlob && !isProcessing && (
          <div style={{ marginTop: '2rem', animation: 'fadeIn 0.5s' }}>
            <div style={{ color: '#10b981', display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <CheckCircle size={64} />
            </div>
            <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.4rem' }}>Conversão Concluída!</h2>
            <p style={{ color: 'var(--text-muted)' }}>O material didático está pronto para distribuição.</p>
            
            <button className="primary-btn" onClick={handleDownload}>
              <Download size={20} />
              Baixar {originalName}-html.zip
            </button>
            
            <div style={{ marginTop: '2rem' }}>
              <button 
                onClick={() => setResultBlob(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Converter outro arquivo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
