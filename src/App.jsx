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

  const processData = async (data, isZip) => {
    if (!data || (isZip && !data.name.endsWith('.zip'))) {
      alert("Por favor, selecione um arquivo .zip ou uma pasta extraída do Notion.");
      return;
    }
    
    setOriginalName(isZip ? data.name.replace('.zip', '') : 'Notion-Export');
    setIsProcessing(true);
    setProgress(0);
    setCurrentFile('Iniciando processamento...');
    setResultBlob(null);

    try {
      const generatedBlob = await processZip(data, (percent, fileName) => {
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

  const traverseFileTree = async (item, path = '') => {
    return new Promise((resolve) => {
      if (item.isFile) {
        item.file((file) => {
          resolve([{ path: path + file.name, file }]);
        });
      } else if (item.isDirectory) {
        const dirReader = item.createReader();
        let allEntries = [];
        
        const readEntries = () => {
          dirReader.readEntries(async (entries) => {
            if (entries.length === 0) {
              let results = [];
              for (const entry of allEntries) {
                results = results.concat(await traverseFileTree(entry, path + item.name + "/"));
              }
              resolve(results);
            } else {
              allEntries = allEntries.concat(Array.from(entries));
              readEntries();
            }
          });
        };
        readEntries();
      } else {
        resolve([]);
      }
    });
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    let isZip = false;
    let singleFile = null;
    
    if (items.length === 1) {
      const item = items[0].webkitGetAsEntry();
      if (item && item.isFile) {
         const file = e.dataTransfer.files[0];
         if (file.name.toLowerCase().endsWith('.zip')) {
           isZip = true;
           singleFile = file;
         }
      }
    }

    if (isZip) {
      processData(singleFile, true);
    } else {
      let allFiles = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry();
        if (item) {
           allFiles = allFiles.concat(await traverseFileTree(item));
        }
      }
      processData(allFiles, false);
    }
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
      processData(files[0], true);
    } else {
      const fileData = files.map(f => ({ path: f.webkitRelativePath || f.name, file: f }));
      processData(fileData, false);
    }
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
            <p>Arraste seu arquivo Notion (.zip) ou pasta extraída aqui</p>
            <span>ou clique para procurar pelo seu computador</span>
            <input 
              type="file" 
              multiple
              webkitdirectory="true"
              accept=".zip,application/zip,.md,text/markdown,image/*" 
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
