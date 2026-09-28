import JSZip from 'jszip';
import { ConvoGraph, MemoryNode } from '../types/graph';

export type MemoryExportFormat = 'markdown' | 'text' | 'json' | 'jsonl' | 'all';
export type MemoryOrganization = 'single_file' | 'individual_files' | 'both';

export interface MemoryExportOptions {
  format?: MemoryExportFormat;
  organization?: MemoryOrganization;
  customTemplate?: string;
  includeMetadata?: boolean;
}

export interface ZipExportOptions {
  memoryOptions?: MemoryExportOptions;
  includeSkills?: boolean;
  includeTrajectories?: boolean;
  includeRatings?: boolean;
  includeGraphJson?: boolean;
  includeArtifacts?: boolean;
  includeProjectDocs?: boolean;
}

/**
 * Formats an array of MemoryNode objects into formatted Markdown
 */
export function formatMemoriesAsMarkdown(
  memories: MemoryNode[], 
  options?: { includeMetadata?: boolean; customTemplate?: string }
): string {
  if (memories.length === 0) {
    return '# Memory Store\n\n*No memories recorded in this export.*\n';
  }

  const { includeMetadata = true, customTemplate } = options || {};

  // If a custom template is provided, apply per memory
  if (customTemplate && customTemplate.trim()) {
    return memories.map((m, index) => {
      let output = customTemplate;
      const title = m.title || `Memory #${index + 1}`;
      const dateStr = m.timestamp ? new Date(m.timestamp).toISOString() : 'Unknown date';
      const tagsStr = (m.tags && m.tags.length > 0) ? m.tags.join(', ') : 'None';
      const tagsSection = (m.tags && m.tags.length > 0) 
        ? `- **Tags:** ${m.tags.map(t => `\`${t}\``).join(' ')}` 
        : '';

      output = output.replace(/\{\{id\}\}/g, m.id);
      output = output.replace(/\{\{title\}\}/g, title);
      output = output.replace(/\{\{content\}\}/g, m.content);
      output = output.replace(/\{\{source\}\}/g, m.source);
      output = output.replace(/\{\{date\}\}/g, dateStr);
      output = output.replace(/\{\{tags\}\}/g, tagsStr);
      output = output.replace(/\{\{tags_section\}\}/g, tagsSection);
      return output;
    }).join('\n\n---\n\n');
  }

  // Default clean structured markdown format
  const lines: string[] = [];
  lines.push('# ConvoWorkbench Memory Store');
  lines.push(`*Generated on ${new Date().toLocaleString()} &bull; Total Memories: ${memories.length}*\n`);

  // Table of Contents if more than 3 memories
  if (memories.length > 3) {
    lines.push('## Contents');
    memories.forEach((m, idx) => {
      const title = m.title || `Memory ${idx + 1} (${m.source})`;
      const anchor = `memory-${idx + 1}-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      lines.push(`- [${title}](#${anchor})`);
    });
    lines.push('\n---\n');
  }

  memories.forEach((m, idx) => {
    const title = m.title || `Memory ${idx + 1}`;
    const anchor = `memory-${idx + 1}-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const dateStr = m.timestamp ? new Date(m.timestamp).toLocaleString() : 'N/A';
    
    lines.push(`## ${title} <a id="${anchor}"></a>`);
    
    if (includeMetadata) {
      lines.push(`- **Source:** \`${m.source}\``);
      lines.push(`- **Timestamp:** ${dateStr}`);
      if (m.tags && m.tags.length > 0) {
        lines.push(`- **Tags:** ${m.tags.map(t => `\`${t}\``).join(' ')}`);
      }
      if (m.external_id) {
        lines.push(`- **External ID:** \`${m.external_id}\``);
      }
      lines.push('');
    }

    lines.push('### Content');
    lines.push(m.content);
    lines.push('\n---\n');
  });

  return lines.join('\n');
}

/**
 * Formats an array of MemoryNode objects into Plain Text
 */
export function formatMemoriesAsPlainText(memories: MemoryNode[]): string {
  if (memories.length === 0) return 'CONVOWORKBENCH MEMORY STORE\nNo memories recorded.\n';

  const separator = '='.repeat(72);
  const subSeparator = '-'.repeat(72);

  const parts = [
    separator,
    'CONVOWORKBENCH MEMORY STORE (PLAIN TEXT)',
    `Export Date: ${new Date().toISOString()}`,
    `Total Items: ${memories.length}`,
    separator,
    ''
  ];

  memories.forEach((m, i) => {
    const title = m.title || `Item ${i + 1}`;
    const dateStr = m.timestamp ? new Date(m.timestamp).toISOString() : 'Unknown';
    const tagsStr = (m.tags && m.tags.length > 0) ? m.tags.join(', ') : 'none';

    parts.push(`[#${i + 1}] ${title}`);
    parts.push(`Source: ${m.source} | Date: ${dateStr} | ID: ${m.id}`);
    parts.push(`Tags: ${tagsStr}`);
    parts.push(subSeparator);
    parts.push(m.content);
    parts.push('');
    parts.push(separator);
    parts.push('');
  });

  return parts.join('\n');
}

/**
 * Formats an array of MemoryNode objects into JSON string
 */
export function formatMemoriesAsJson(memories: MemoryNode[]): string {
  return JSON.stringify(memories, null, 2);
}

/**
 * Formats an array of MemoryNode objects into JSON Lines (JSONL) string
 */
export function formatMemoriesAsJsonl(memories: MemoryNode[]): string {
  return memories.map(m => JSON.stringify(m)).join('\n');
}

/**
 * Generates a complete ZIP archive with user-customized memory exports
 */
export async function generateExportZip(
  graph: ConvoGraph, 
  options: ZipExportOptions = {}
): Promise<Blob> {
  const {
    memoryOptions = { format: 'markdown', organization: 'both' },
    includeSkills = true,
    includeTrajectories = true,
    includeRatings = true,
    includeGraphJson = true,
    includeArtifacts = true,
    includeProjectDocs = true
  } = options;

  const zip = new JSZip();

  // 1. Process Skills (gitagent-compatible directory structure)
  if (includeSkills && graph.skills) {
    const skillsFolder = zip.folder('skills');
    Object.values(graph.skills).forEach(skill => {
      const folderName = skill.id || skill.title?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'skill';
      const skillFolder = skillsFolder?.folder(folderName);
      skillFolder?.file('SKILL.md', skill.content);
    });
  }

  // 2. Process Memories with Custom Formats
  const memoriesList = Object.values(graph.memories || {});
  const memoryFormat = memoryOptions.format || 'markdown';
  const memoryOrg = memoryOptions.organization || 'both';

  const memoriesFolder = zip.folder('memories');

  // Memories overview README
  memoriesFolder?.file('README.md', [
    '# Exported ConvoWorkbench Memories',
    '',
    `Total memories exported: ${memoriesList.length}`,
    `Exported at: ${new Date().toISOString()}`,
    `Export format: ${memoryFormat}`,
    '',
    '## Source Distribution',
    ...Object.entries(
      memoriesList.reduce((acc, m) => {
        acc[m.source] = (acc[m.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).map(([src, count]) => `- **${src}**: ${count}`),
    '',
    'Supported integration with external engines like Vectorize Hindsight, local agent context windows, and retrieval systems.'
  ].join('\n'));

  // Export based on chosen format(s)
  if (memoryFormat === 'markdown' || memoryFormat === 'all') {
    const mdContent = formatMemoriesAsMarkdown(memoriesList, {
      includeMetadata: memoryOptions.includeMetadata ?? true,
      customTemplate: memoryOptions.customTemplate
    });
    memoriesFolder?.file('memories.md', mdContent);

    // If individual files requested
    if (memoryOrg === 'individual_files' || memoryOrg === 'both') {
      const itemsFolder = memoriesFolder?.folder('items');
      memoriesList.forEach((m, idx) => {
        const cleanTitle = (m.title || `memory_${idx + 1}`)
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '_')
          .slice(0, 40);
        const fileName = `${idx + 1}_${cleanTitle}.md`;
        const singleMd = formatMemoriesAsMarkdown([m], {
          includeMetadata: memoryOptions.includeMetadata ?? true,
          customTemplate: memoryOptions.customTemplate
        });
        itemsFolder?.file(fileName, singleMd);
      });
    }
  }

  if (memoryFormat === 'text' || memoryFormat === 'all') {
    const textContent = formatMemoriesAsPlainText(memoriesList);
    memoriesFolder?.file('memories.txt', textContent);
  }

  if (memoryFormat === 'json' || memoryFormat === 'all') {
    const jsonContent = formatMemoriesAsJson(memoriesList);
    memoriesFolder?.file('memories.json', jsonContent);
  }

  if (memoryFormat === 'jsonl') {
    const jsonlContent = formatMemoriesAsJsonl(memoriesList);
    memoriesFolder?.file('memories.jsonl', jsonlContent);
  }

  // 3. Trajectories
  if (includeTrajectories && graph.trajectories) {
    zip.file('trajectories.json', JSON.stringify(graph.trajectories, null, 2));
  }

  // 4. Ratings
  if (includeRatings && graph.conversations) {
    const ratingsData = Object.values(graph.conversations)
      .filter(c => c.rating)
      .map(c => ({ id: c.id, title: c.title, rating: c.rating, notes: c.notes }));
    zip.file('ratings.json', JSON.stringify(ratingsData, null, 2));
  }

  // 5. Artifacts
  if (includeArtifacts && graph.artifacts && Object.keys(graph.artifacts).length > 0) {
    const artifactsFolder = zip.folder('artifacts');
    Object.values(graph.artifacts).forEach(art => {
      const ext = art.language === 'python' ? 'py' : art.language === 'typescript' ? 'ts' : art.language === 'javascript' ? 'js' : 'txt';
      const cleanTitle = (art.title || art.id).toLowerCase().replace(/[^a-z0-9]/g, '_');
      artifactsFolder?.file(`${cleanTitle}.${ext}`, art.content);
    });
  }

  // 6. Project Docs
  if (includeProjectDocs && graph.project_docs && Object.keys(graph.project_docs).length > 0) {
    const docsFolder = zip.folder('project_docs');
    Object.values(graph.project_docs).forEach(doc => {
      docsFolder?.file(doc.filename, doc.content);
    });
  }

  // 7. Full Graph JSON Snapshot
  if (includeGraphJson) {
    zip.file('graph.json', JSON.stringify(graph, null, 2));
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Browser helper to trigger export download
 */
export async function downloadExportZip(
  graph: ConvoGraph, 
  options: ZipExportOptions = {}, 
  filename = 'convo-workbench-export.zip'
): Promise<void> {
  const blob = await generateExportZip(graph, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
