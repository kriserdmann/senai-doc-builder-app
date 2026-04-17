import JSZip from 'jszip';
import { marked } from 'marked';
import yaml from 'js-yaml';
import hljs from 'highlight.js';

marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  langPrefix: 'hljs language-'
});

function processMarkdownHTML(html) {
  html = html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (match, inner) => {
    const calloutMatch = inner.match(/^\s*<p>\[!(INFO|WARNING)\](.*?)((<br>|<\/p>|\r?\n)[\s\S]*)$/i);
    if (calloutMatch) {
      const type = calloutMatch[1].toLowerCase();
      const title = calloutMatch[2].trim();
      let rest = calloutMatch[3];
      const h4 = title ? `<h4>${title}</h4>\n` : '';
      if (rest.startsWith('</p>')) rest = rest.substring(4);
      else if (rest.startsWith('<br>')) rest = '<p>' + rest.substring(4);
      else rest = '<p>' + rest.replace(/^\s+/, '');
      return `<div class="callout ${type}">\n${h4}${rest}\n</div>`;
    }
    return match;
  });

  html = html.replace(/<(h[23])(.*?)>(.*?)<\/\1>\s*<(ul|ol)>([\s\S]*?)<\/\4>/g, (match, hTag, hAttrs, hText, listTag, listContent) => {
    const listClass = listTag === 'ul' ? ' class="capabilities-list"' : '';
    return `<div class="card">\n<h3 class="card-title"${hAttrs}>${hText}</h3>\n<${listTag}${listClass}>\n${listContent}\n</${listTag}>\n</div>`;
  });

  html = html.replace(/<img(.*?)alt="(.*?)"(.*?)>/gi, (match, prefix, alt, suffix) => {
    return `<figure class="image-wrapper">\n<img${prefix}alt="${alt}"${suffix}>\n` +
           (alt ? `<figcaption>${alt}</figcaption>\n` : '') +
           `</figure>`;
  });

  html = html.replace(/<p>([💡ℹ️])\s*([\s\S]*?)<\/p>/gi, '<div class="callout info">\n<p>$2</p>\n</div>');
  html = html.replace(/<p>([⚠️🚨])\s*([\s\S]*?)<\/p>/gi, '<div class="callout warning">\n<p>$2</p>\n</div>');

  return html;
}

function processTemplate(templateStr, data) {
  let result = templateStr;
  result = result.replace(/\{\{id\}\}/g, data.id || '');
  result = result.replace(/\{\{title\}\}/g, data.title || '');
  result = result.replace(/\{\{duration\}\}/g, data.duration || '');
  result = result.replace(/\{\{description\}\}/g, data.description || '');
  if (data.duration) {
    result = result.replace(/\{\{#if duration\}\}([\s\S]*?)\{\{\/if\}\}/gd, '$1');
  } else {
    result = result.replace(/\{\{#if duration\}\}[\s\S]*?\{\{\/if\}\}/gd, '');
  }
  if (data.description) {
    result = result.replace(/\{\{#if description\}\}([\s\S]*?)\{\{\/if\}\}/gd, '$1');
  } else {
    result = result.replace(/\{\{#if description\}\}[\s\S]*?\{\{\/if\}\}/gd, '');
  }
  result = result.replace(/\{\{content\}\}/g, data.content || '');
  return result;
}

function stripNotionUUID(name) {
  return name.replace(/\s+[0-9a-f]{32}$/, '').trim();
}

function slugify(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function parseSortKey(cleanName) {
  const m = cleanName.match(/^(\d+)\s+(\d+)/);
  if (m) {
    return `${m[1].padStart(2,'0')}.${m[2].padStart(2,'0')}`;
  }
  return cleanName;
}

function extractBlockFromName(cleanName) {
  const m = cleanName.match(/^(\d+)\s+(\d+)\s+(.+)/);
  if (m) {
    return `Bloco ${m[1]}`;
  }
  return 'Aulas';
}

function getBasename(filePath) {
  const parts = filePath.split('/');
  const filename = parts[parts.length - 1];
  return filename.split('.').slice(0, -1).join('.') || filename;
}

async function fetchAssetAsBlob(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return await res.blob();
}

export async function processZip(inputZipFileOrArray, onProgress) {
  const inZip = new JSZip();
  if (inputZipFileOrArray instanceof File && inputZipFileOrArray.name.toLowerCase().endsWith('.zip')) {
    await inZip.loadAsync(inputZipFileOrArray);
  } else if (Array.isArray(inputZipFileOrArray)) {
    for (const item of inputZipFileOrArray) {
      inZip.file(item.path, item.file);
    }
  }
  
  const outZip = new JSZip();

  // Load Templates
  const layoutReq = await fetch('/templates/layout.html');
  const indexReq = await fetch('/templates/index.html');
  
  const layoutTemplate = await layoutReq.text();
  const indexTemplate = await indexReq.text();

  let syllabus = [];
  let allAttachments = [];
  let totalFiles = Object.keys(inZip.files).length;
  let processedFiles = 0;

  let mdFiles = Object.keys(inZip.files).filter(p => !inZip.files[p].dir && p.toLowerCase().endsWith('.md'));
  let shallowestMd = mdFiles.length > 0 ? mdFiles.reduce((min, p) => p.split('/').length < min.split('/').length ? p : min, mdFiles[0]) : null;

  for (const [relativePath, file] of Object.entries(inZip.files)) {
    if (file.dir) continue;

    processedFiles++;
    if (onProgress) onProgress(processedFiles / totalFiles, relativePath);

    // Filter if it's an image or attachment
    if (relativePath.match(/\.(jpg|jpeg|png|gif|svg|webp|pdf|mp4|webm|csv|txt|zip)$/i)) {
      const decodedName = decodeURIComponent(relativePath.split('/').pop());
      const blob = await file.async('blob');
      outZip.file(`images/${decodedName}`, blob);
      continue;
    }

    if (!relativePath.toLowerCase().endsWith('.md')) continue;

    const originalFilename = relativePath.split('/').pop();
    const fileName = getBasename(originalFilename);
    const fileContent = await file.async('string');

    const isNotionExport = /[0-9a-f]{32}$/.test(fileName);
    let meta = {};
    let markdownContent = fileContent;

    if (!isNotionExport) {
      const match = fileContent.match(/^(?:---)\r?\n([\s\S]+?)\r?\n(?:---)\r?\n([\s\S]*)$/);
      if (match) {
        try { meta = yaml.load(match[1]); markdownContent = match[2]; } catch (e) { console.error('YAML error:', e); }
      }
    }

    let title = meta.title || '';
    let block = meta.block || 'Aulas';
    let duration = meta.duration || '';
    let description = meta.description || '';
    let baseName = fileName;

    if (isNotionExport) {
      const cleanName = stripNotionUUID(fileName);
      block = extractBlockFromName(cleanName);
      baseName = slugify(cleanName);
    }

    // Strip the FIRST H1
    const h1Match = markdownContent.match(/^(?:#\s+)(.+)$/m);
    if (h1Match) {
      if (!title || isNotionExport) {
        title = h1Match[1].trim();
      }
      markdownContent = markdownContent.replace(h1Match[0], '').replace(/^\s+/, '');
    } else if (isNotionExport && !title) {
       title = stripNotionUUID(fileName);
    }

    // Extract PDFs
    let pageAttachments = [];
    markdownContent = markdownContent.replace(/\[([^\]]+)\]\((.*?\.pdf)\)/gi, (match, text, url) => {
      const decodedUrl = decodeURIComponent(url);
      const filename = decodedUrl.split('/').pop();
      pageAttachments.push({ text, filename });
      return '';
    });

    // Fix image paths
    markdownContent = markdownContent
      .replace(/!\[(.*?)\]\(attachment:[^:)]+:(.*?)\)/g, '![$1](images/$2)')
      .replace(/!\[(.*?)\]\(([^)]+?)\/([\w%.-]+\.(jpg|jpeg|png|gif|svg|webp))\)/gi, '![$1](images/$3)')
      .replace(/!\[(.*?)\]\(([^)]+%[0-9A-F]{2}[^)]*\.(jpg|jpeg|png|gif|svg|webp))\)/gi, (m, alt, encoded) => {
        const decoded = decodeURIComponent(encoded.split('/').pop());
        return `![${alt}](images/${decoded})`;
      });

    let htmlContent = marked.parse(markdownContent);
    htmlContent = processMarkdownHTML(htmlContent);

    if (pageAttachments.length > 0) {
      let attachesHtml = `\n<div class="card" style="margin-top: 2rem;">\n<h3 class="card-title">📎 Anexos</h3>\n<ul class="capabilities-list">\n`;
      pageAttachments.forEach(att => {
        const url = `images/${att.filename}`;
        attachesHtml += `<li><a href="${url}" target="_blank" style="text-decoration:none; color:inherit;"><strong>${att.text}</strong> (PDF Document)</a></li>\n`;
        if (!allAttachments.find(a => a.url === url)) {
           allAttachments.push({ text: att.text, url });
        }
      });
      attachesHtml += `</ul>\n</div>\n`;
      htmlContent += attachesHtml;
    }

    const isExplicitIndex = baseName.toLowerCase() === 'index';
    const isIndex = isExplicitIndex || (relativePath === shallowestMd);
    const outName = isIndex ? 'index' : baseName;
    const template = isIndex ? indexTemplate : layoutTemplate;
    const finalHtml = processTemplate(template, { id: outName, title, duration, description, content: htmlContent });

    outZip.file(`${outName}.html`, finalHtml);

    if (!isIndex) {
      syllabus.push({ id: outName, title: title || outName, block, duration, sortKey: isNotionExport ? parseSortKey(stripNotionUUID(fileName)) : outName });
    }
  }

  syllabus.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const dataJsContent = `const syllabus = ${JSON.stringify(syllabus, null, 2)};\nconst attachments = ${JSON.stringify(allAttachments, null, 2)};`;
  outZip.file('js/data.js', dataJsContent);

  // Bundle Public Assets
  const assets = [
    { path: '/style.css', dest: 'style.css' },
    { path: '/js/app.js', dest: 'js/app.js' },
    { path: '/images/logo-senai.png', dest: 'images/logo-senai.png' }
  ];

  for (let asset of assets) {
    try {
      const blob = await fetchAssetAsBlob(asset.path);
      outZip.file(asset.dest, blob);
    } catch (e) {
      console.warn(`Could not bundle static asset ${asset.path}`, e);
    }
  }

  const generatedZipBlob = await outZip.generateAsync({ type: 'blob' });
  return generatedZipBlob;
}
