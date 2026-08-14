"use client";

import { useMemo, useEffect } from 'react';
import { ReactFlow, Background, Controls, Node, Edge, MarkerType, useNodesState, useEdgesState, Position, Handle, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ReviewerData } from '@/lib/types';
import dagre from 'dagre';
import { Network, Sparkles, BrainCircuit } from 'lucide-react';

const nodeWidth = 280;
const nodeHeight = 80;

// Custom Node for the Root Subject
function RootNode({ data }: NodeProps) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-6 py-4 text-center shadow-lg shadow-brand/10 transition-all hover:scale-[1.02] dark:border-zinc-700 dark:bg-zinc-900">
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-brand !border-2 !border-zinc-900" />
      <div className="flex items-center gap-3">
        <Sparkles className="text-brand" size={20} />
        <span className="text-base font-semibold text-white">{data.label as string}</span>
      </div>
    </div>
  );
}

// Custom Node for general Concepts
function ConceptNode({ data }: NodeProps) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-6 py-4 text-center shadow-sm transition-all hover:scale-[1.02] hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/80">
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-zinc-300 !border-2 !border-white dark:!border-zinc-900" />
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{data.label as string}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-zinc-300 !border-2 !border-white dark:!border-zinc-900" />
    </div>
  );
}

const nodeTypes = {
  root: RootNode,
  concept: ConceptNode,
};

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  // Increased spacing for a much larger, breathable map
  dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 220 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: direction === 'LR' ? Position.Left : Position.Top,
      sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export default function ConceptMap({ reviewer }: { reviewer: ReviewerData }) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodesMap = new Map<string, Node>();
    const edges: Edge[] = [];
    const mappings = reviewer.conceptMap?.mappings || [];

    if (mappings.length > 0) {
      mappings.forEach(([source, label, target], i) => {
        const isRoot = source === mappings[0][0];

        if (!nodesMap.has(source)) {
          nodesMap.set(source, {
            id: source,
            type: isRoot ? 'root' : 'concept',
            data: { label: source },
            position: { x: 0, y: 0 },
            style: { width: nodeWidth, height: nodeHeight }
          });
        }
        if (!nodesMap.has(target)) {
          nodesMap.set(target, {
            id: target,
            type: 'concept',
            data: { label: target },
            position: { x: 0, y: 0 },
            style: { width: nodeWidth, height: nodeHeight }
          });
        }

        edges.push({
          id: `e-${source}-${target}-${i}`,
          source,
          target,
          label,
          type: 'smoothstep',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#a1a1aa' },
          style: { stroke: '#a1a1aa', strokeWidth: 2.5 },
          labelStyle: { fill: '#3f3f46', fontWeight: 700, fontSize: 13, letterSpacing: 0.5 },
          labelBgStyle: { fill: '#ffffff', fillOpacity: 1, stroke: '#e4e4e7', strokeWidth: 1 },
          labelBgPadding: [10, 6],
          labelBgBorderRadius: 8,
        });
      });
    }

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      Array.from(nodesMap.values()),
      edges,
      'LR'
    );
    return { initialNodes: layoutedNodes, initialEdges: layoutedEdges };
  }, [reviewer]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  if (!reviewer.conceptMap?.isNeeded && initialNodes.length === 0) {
     return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
          <BrainCircuit className="mb-4 text-zinc-300" size={36} />
          <p className="text-sm font-semibold text-zinc-500">No complex relationships found.</p>
          <p className="mt-1 text-xs text-zinc-400">The AI determined a concept map wasn't necessary for this material.</p>
        </div>
     );
  }

  return (
    <div className="h-[800px] w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 overflow-hidden shadow-inner dark:border-zinc-800 dark:bg-zinc-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        className="dark:opacity-90"
      >
        <Background gap={24} size={1.5} color="#e4e4e7" />
        <Controls showInteractive={false} className="!mb-4 !mr-4 rounded-xl shadow-md" />
      </ReactFlow>
    </div>
  );
}
