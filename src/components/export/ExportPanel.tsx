import React from 'react';
import { useGraph } from '@/src/contexts/GraphContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Download, FileJson, Archive, FileText } from 'lucide-react';
import JSZip from 'jszip';

export function ExportPanel() {
  const { state } = useGraph();

  const downloadJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    
    // Skills
    const skillsFolder = zip.folder('skills');
    (Object.values(state.skills) as any[]).forEach(skill => {
      const skillFolder = skillsFolder?.folder(skill.id);
      skillFolder?.file('SKILL.md', skill.content);
    });

    // Data
    zip.file('graph.json', JSON.stringify(state, null, 2));
    zip.file('trajectories.json', JSON.stringify(state.trajectories, null, 2));
    zip.file('ratings.json', JSON.stringify(
      (Object.values(state.conversations) as any[])
        .filter(c => c.rating)
        .map(c => ({ id: c.id, rating: c.rating, notes: c.notes })),
      null, 2
    ));

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'convo-workbench-export.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Export Artifacts</h2>
        <p className="text-zinc-500">Download your distilled skills and rated ConvoGraph.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Archive className="w-5 h-5 text-zinc-900" />
              Full Bundle (ZIP)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-600">
              Includes gitagent-compatible skills/ directory, full graph snapshot, and all ratings.
            </p>
            <Button className="w-full gap-2" onClick={downloadZip}>
              <Download className="w-4 h-4" /> Download skills.zip
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileJson className="w-5 h-5 text-zinc-900" />
              JSON Snapshots
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => downloadJson(state, 'graph.json')}>
              <Download className="w-4 h-4" /> graph.json
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => downloadJson(state.trajectories, 'trajectories.json')}>
              <Download className="w-4 h-4" /> trajectories.json
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => downloadJson(state.skills, 'skills.json')}>
              <Download className="w-4 h-4" /> skills.json
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
