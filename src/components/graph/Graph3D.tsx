import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph3D, { ForceGraphMethods } from 'react-force-graph-3d';
import { ConvoGraph } from '@/src/types/graph';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { X, Volume2, BrainCircuit, MessageSquare, Target, Zap, ExternalLink } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useProvider } from '@/src/contexts/ProviderContext';
import { cn } from '@/src/lib/utils';

interface Graph3DProps {
  graph: ConvoGraph;
}

export function Graph3D({ graph }: Graph3DProps) {
  const fgRef = React.useRef<ForceGraphMethods>(null);
  const [selectedNode, setSelectedNode] = React.useState<any>(null);
  const [summary, setSummary] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const { getProvider, apiKeys, taskConfigs } = useProvider();
  const navigate = useNavigate();
  
  const summaryConfig = taskConfigs.summary || { providerId: 'google', modelId: 'gemini-3-flash-preview', parameters: { temperature: 0.5, maxTokens: 1000 } };
  const activeProvider = getProvider(summaryConfig.providerId);

  const playAudio = async (base64: string) => {
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const int16Data = new Int16Array(bytes.buffer);
      const float32Data = new Float32Array(int16Data.length);
      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768;
      }
      
      const buffer = audioContext.createBuffer(1, float32Data.length, 24000);
      buffer.getChannelData(0).set(float32Data);
      
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.onended = () => setSpeaking(false);
      source.start();
    } catch (err) {
      console.error('Audio playback failed:', err);
      setSpeaking(false);
    }
  };

  const generateNodeSummary = async (node: any) => {
    setLoading(true);
    setSummary(null);
    try {
      if (!activeProvider) throw new Error('Provider not found');

      let context = '';
      if (node.type === 'conversation') {
        const convo = graph.conversations[node.id];
        context = `Conversation Title: ${convo.title}\nMessages: ${JSON.stringify(convo.messages.slice(0, 5))}`;
      } else if (node.type === 'topic') {
        const topic = graph.topics[node.id];
        context = `Topic: ${topic.label}\nConversations: ${topic.conversation_ids.length}`;
      } else if (node.type === 'skill') {
        const skill = graph.skills[node.id];
        context = `Skill: ${skill.title}\nDescription: ${skill.content}`;
      }

      const prompt = {
        system: "You are a Graph Intelligence Assistant. Provide a creative, one-sentence summary of the selected node. Be concise and insightful.",
        user: `Node Data: ${context}`
      };

      const result = await activeProvider.generate(prompt, apiKeys[summaryConfig.providerId], summaryConfig.modelId);
      setSummary(result.text);
    } catch (err) {
      console.error(err);
      setSummary('Failed to generate summary.');
    } finally {
      setLoading(false);
    }
  };

  const handleSpeak = async () => {
    if (!summary || speaking) return;
    setSpeaking(true);
    try {
      if (!activeProvider || !activeProvider.speak) throw new Error('TTS not available');

      const base64 = await activeProvider.speak(summary, apiKeys[summaryConfig.providerId]);
      await playAudio(base64);
    } catch (err) {
      console.error(err);
      setSpeaking(false);
    }
  };

  const data = React.useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];

    // Add Topics
    Object.values(graph.topics).forEach(topic => {
      nodes.push({
        id: topic.id,
        name: topic.label,
        type: 'topic',
        val: 15,
        color: '#FF6103' // brand-orange
      });

      topic.conversation_ids.forEach(convoId => {
        if (graph.conversations[convoId]) {
          links.push({
            source: topic.id,
            target: convoId,
            type: 'topic-convo'
          });
        }
      });
    });

    // Add Conversations
    Object.values(graph.conversations).forEach(convo => {
      nodes.push({
        id: convo.id,
        name: convo.title || 'Untitled',
        type: 'conversation',
        val: 8,
        color: convo.rating ? (convo.rating.correctness === 'correct' ? '#22c55e' : '#ef4444') : '#64748b'
      });
    });

    // Add Trajectories
    Object.values(graph.trajectories).forEach(traj => {
      nodes.push({
        id: traj.id,
        name: 'Trajectory',
        type: 'trajectory',
        val: 12,
        color: '#556B2F' // brand-green (mapped to trajectories)
      });

      traj.conversation_ids.forEach(convoId => {
        if (graph.conversations[convoId]) {
          links.push({
            source: traj.id,
            target: convoId,
            type: 'traj-convo'
          });
        }
      });
    });

    // Add Skills
    Object.values(graph.skills).forEach(skill => {
      nodes.push({
        id: skill.id,
        name: skill.title,
        type: 'skill',
        val: 20,
        color: '#0072CE' // brand-blue
      });

      skill.source_trajectory_ids.forEach(trajId => {
        if (graph.trajectories[trajId]) {
          links.push({
            source: skill.id,
            target: trajId,
            type: 'skill-traj'
          });
        }
      });
    });

    return { nodes, links };
  }, [graph]);

  const nodeThreeObject = React.useCallback((node: any) => {
    const group = new THREE.Group();
    
    // Main sphere
    const geometry = new THREE.SphereGeometry(node.val / 2, 16, 16);
    const material = new THREE.MeshPhongMaterial({ 
      color: node.color,
      transparent: true,
      opacity: 0.9,
      shininess: 100
    });
    const sphere = new THREE.Mesh(geometry, material);
    group.add(sphere);

    // Add glow effect if it's a skill or topic
    if (node.type === 'skill' || node.type === 'topic') {
      const glowGeo = new THREE.SphereGeometry(node.val / 1.8, 16, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: node.color,
        transparent: true,
        opacity: 0.15
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      group.add(glow);
    }

    return group;
  }, []);

  return (
    <div className="w-full h-full bg-brand-bg rounded-xl overflow-hidden border border-border/70 relative">
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        nodeLabel="name"
        nodeThreeObject={nodeThreeObject}
        linkWidth={1.5}
        linkColor={() => 'rgba(0,0,0,0.15)'}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={false}
        onNodeClick={(node: any) => {
          setSelectedNode(node);
          generateNodeSummary(node);
          // Aim at node from outside it
          const distance = 40;
          const hypot = Math.hypot(node.x, node.y, node.z);
          const distRatio = hypot > 0 ? 1 + distance / hypot : 1;

          fgRef.current?.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new pos
            node, // lookAt ({ x, y, z })
            3000  // ms transition duration
          );
        }}
      />

      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute top-4 right-4 w-80 bg-card/80 backdrop-blur-md border border-border/50 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedNode.type === 'topic' && <BrainCircuit className="w-4 h-4 text-brand-orange" />}
                  {selectedNode.type === 'conversation' && <MessageSquare className="w-4 h-4 text-slate-400" />}
                  {selectedNode.type === 'trajectory' && <Target className="w-4 h-4 text-brand-pink" />}
                  {selectedNode.type === 'skill' && <Zap className="w-4 h-4 text-white" />}
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {selectedNode.type}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 rounded-full hover:bg-white/10" 
                  onClick={() => setSelectedNode(null)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>

              <div>
                <h3 className="text-sm font-medium leading-tight">{selectedNode.name}</h3>
                <div className="mt-2 min-h-[3rem]">
                  {loading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                      <BrainCircuit className="w-3 h-3 animate-spin" />
                      Distilling insights...
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic leading-relaxed">
                      {summary}
                    </p>
                  )}
                </div>
              </div>

              {summary && !loading && (
                <div className="flex justify-end gap-2">
                  {selectedNode.type === 'conversation' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-2 text-[10px] uppercase tracking-wider border-border/50 hover:bg-brand-pink/10 hover:text-brand-pink hover:border-brand-pink/50 transition-all"
                      onClick={() => navigate(`/review?id=${selectedNode.id}`)}
                    >
                      <ExternalLink className="w-3 h-3" />
                      View
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn(
                      "h-8 gap-2 text-[10px] uppercase tracking-wider hover:bg-brand-orange/10 hover:text-brand-orange",
                      speaking && "text-brand-orange bg-brand-orange/10"
                    )}
                    onClick={handleSpeak}
                    disabled={speaking}
                  >
                    <Volume2 className={cn("w-3 h-3", speaking && "animate-pulse")} />
                    {speaking ? "Speaking..." : "Listen"}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-4 left-4 flex gap-4 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-brand-orange" />
          <span className="text-[10px] font-mono uppercase text-muted-foreground">Topics</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-brand-pink" />
          <span className="text-[10px] font-mono uppercase text-muted-foreground">Trajectories</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-400" />
          <span className="text-[10px] font-mono uppercase text-muted-foreground">Conversations</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-white" />
          <span className="text-[10px] font-mono uppercase text-muted-foreground">Skills</span>
        </div>
      </div>
    </div>
  );
}
