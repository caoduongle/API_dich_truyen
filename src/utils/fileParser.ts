import JSZip from 'jszip';

export function parseTxtContent(fullText: string, method: 'regex' | 'chunk'): { title: string; sourceText: string }[] {
  const chapters: { title: string; sourceText: string }[] = [];

  if (method === 'regex') {
    const lines = fullText.split(/\r?\n/);
    let currentChapterTitle = "Khởi đầu / Phần mở đầu";
    let currentLines: string[] = [];
    const chapRegex = /^\s*(Chương\s+\d+|Chương\s+[I|V|X|L|C|D|M]+|第[零一二三四五六七八九十百千万\d]+[章节])/i;

    for (const line of lines) {
      if (chapRegex.test(line)) {
        if (currentLines.length > 0) {
          chapters.push({
            title: currentChapterTitle,
            sourceText: currentLines.join("\n").trim()
          });
        }
        currentChapterTitle = line.trim();
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0 || String(currentChapterTitle).trim() !== "") {
      chapters.push({
        title: currentChapterTitle,
        sourceText: currentLines.join("\n").trim() || "Không có nội dung"
      });
    }
  } else {
    const chunkSize = 8000;
    for (let i = 0; i < fullText.length; i += chunkSize) {
      const textChunk = fullText.substring(i, i + chunkSize);
      chapters.push({
        title: `Phần ${Math.floor(i / chunkSize) + 1}`,
        sourceText: textChunk.trim()
      });
    }
  }

  return chapters.filter(c => c.sourceText.length > 10);
}

export async function parseEpubFile(file: File): Promise<{ title: string; sourceText: string }[]> {
  const zip = await JSZip.loadAsync(file);
  let opfPath = 'content.opf';
  const containerFile = zip.file('META-INF/container.xml');
  if (containerFile) {
    const containerContent = await containerFile.async('text');
    const parser = new DOMParser();
    const doc = parser.parseFromString(containerContent, 'text/xml');
    const rootfilePath = doc.querySelector('rootfile')?.getAttribute('full-path');
    if (rootfilePath) {
      opfPath = rootfilePath;
    }
  }

  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    const foundOpf = Object.keys(zip.files).find(name => name.endsWith('.opf'));
    if (foundOpf) {
      const opfContent = await zip.files[foundOpf].async('text');
      return parseEpubOpf(zip, foundOpf, opfContent);
    } else {
      const fallbackHtmlFiles = Object.keys(zip.files).filter(name => 
        name.endsWith('.html') || name.endsWith('.xhtml') || name.endsWith('.htm')
      );
      fallbackHtmlFiles.sort();
      return parseEpubFallback(zip, fallbackHtmlFiles);
    }
  }

  const opfContent = await opfFile.async('text');
  return parseEpubOpf(zip, opfPath, opfContent);
}

async function parseEpubOpf(zip: JSZip, opfPath: string, opfContent: string): Promise<{ title: string; sourceText: string }[]> {
  const parser = new DOMParser();
  const opfDoc = parser.parseFromString(opfContent, 'text/xml');
  
  const items: Record<string, { href: string; mediaType: string }> = {};
  const itemElements = opfDoc.querySelectorAll('manifest > item');
  itemElements.forEach(el => {
    const id = el.getAttribute('id');
    const href = el.getAttribute('href');
    const mediaType = el.getAttribute('media-type');
    if (id && href) {
      items[id] = { href, mediaType: mediaType || '' };
    }
  });

  const spineIds: string[] = [];
  const spineElements = opfDoc.querySelectorAll('spine > itemref');
  spineElements.forEach(el => {
    const idref = el.getAttribute('idref');
    if (idref) {
      spineIds.push(idref);
    }
  });

  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
  const chapters: { title: string; sourceText: string }[] = [];

  for (const idref of spineIds) {
    const item = items[idref];
    if (!item) continue;

    if (!item.mediaType.includes('xml') && !item.mediaType.includes('html') && !item.href.endsWith('.html') && !item.href.endsWith('.xhtml')) {
      continue;
    }

    let relativePath = item.href;
    try {
      relativePath = decodeURIComponent(relativePath);
    } catch (_) {}

    let fullPath = opfDir + relativePath;

    if (fullPath.includes('../')) {
      const parts = fullPath.split('/');
      const resolvedParts: string[] = [];
      for (const p of parts) {
        if (p === '..') {
          resolvedParts.pop();
        } else if (p !== '.') {
          resolvedParts.push(p);
        }
      }
      fullPath = resolvedParts.join('/');
    }

    let zipFile = zip.file(fullPath);
    if (!zipFile) {
      const lowerPath = fullPath.toLowerCase();
      const fuzzyKey = Object.keys(zip.files).find(k => k.toLowerCase() === lowerPath || k.toLowerCase().endsWith('/' + relativePath.toLowerCase()));
      if (fuzzyKey) {
        zipFile = zip.file(fuzzyKey);
      }
    }

    if (zipFile) {
      const textContent = await zipFile.async('text');
      const htmlDoc = parser.parseFromString(textContent, 'text/html');
      
      htmlDoc.querySelectorAll('script, style, iframe').forEach(el => el.remove());
      const pageText = htmlDoc.body?.textContent || htmlDoc.documentElement?.textContent || '';
      
      let headerTitle = htmlDoc.querySelector('title')?.textContent || htmlDoc.querySelector('h1, h2, h3, h4')?.textContent || '';
      headerTitle = headerTitle.replace(/\s+/g, ' ').trim();
      if (!headerTitle) {
        headerTitle = relativePath.split('/').pop()?.replace(/\.(xhtml|html|xml|htm)$/i, '') || 'Chương không tên';
      }

      if (pageText.trim().length > 50) {
        chapters.push({
          title: headerTitle,
          sourceText: pageText.trim()
        });
      }
    }
  }

  if (chapters.length > 0) {
    return chapters;
  } else {
    const fallbackHtmlFiles = Object.keys(zip.files).filter(name => 
      name.endsWith('.html') || name.endsWith('.xhtml') || name.endsWith('.htm')
    );
    fallbackHtmlFiles.sort();
    return parseEpubFallback(zip, fallbackHtmlFiles);
  }
}

async function parseEpubFallback(zip: JSZip, filePaths: string[]): Promise<{ title: string; sourceText: string }[]> {
  const parser = new DOMParser();
  const chapters: { title: string; sourceText: string }[] = [];
  
  for (const filePath of filePaths) {
    const fileContent = await zip.files[filePath].async('text');
    const doc = parser.parseFromString(fileContent, 'text/html');
    doc.querySelectorAll('script, style, iframe').forEach(el => el.remove());
    const pageText = doc.body?.textContent || doc.documentElement?.textContent || '';
    
    let headerTitle = doc.querySelector('title')?.textContent || doc.querySelector('h1, h2, h3')?.textContent || filePath.split('/').pop()?.replace(/\.(xhtml|html|htm)$/i, '') || 'Chương';
    headerTitle = headerTitle.trim();
    
    if (pageText.trim().length > 50) {
      chapters.push({
        title: headerTitle,
        sourceText: pageText.trim()
      });
    }
  }
  return chapters;
}
