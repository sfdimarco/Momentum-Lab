import React, { useEffect, useRef, useState, useMemo } from 'react';
import { BlocklyWorkspace } from 'react-blockly';
import * as Blockly from 'blockly';
import { defineCustomBlocks, toolbox } from '../lib/blocks';
import { Undo2, Redo2, Search, Trash2, RotateCcw } from 'lucide-react';

interface BlocklyEditorProps {
  onWorkspaceChange: (workspace: Blockly.WorkspaceSvg) => void;
  onReset?: () => void;
}

// Initialize blocks synchronously at module load time — BEFORE any BlocklyWorkspace renders.
// Using a module-level flag so we only run once even with React StrictMode double-invocations.
// This is the ONLY correct pattern: useEffect is too late (flyout renders on first click before
// the effect fires), and module-level side effects have import-ordering issues with @blockly plugins.
let _blocksRegistered = false;
function ensureBlocksRegistered() {
  if (!_blocksRegistered) { defineCustomBlocks(); _blocksRegistered = true; }
}

const BlocklyEditor: React.FC<BlocklyEditorProps> = ({ onWorkspaceChange, onReset }) => {
  // Call synchronously during render — safe, no side-effects on React tree
  ensureBlocksRegistered();

  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleWorkspaceChange = (workspace: Blockly.WorkspaceSvg) => {
    workspaceRef.current = workspace;
    onWorkspaceChange(workspace);
  };

  const undo = () => {
    if (workspaceRef.current) {
      workspaceRef.current.undo(false);
    }
  };

  const redo = () => {
    if (workspaceRef.current) {
      workspaceRef.current.undo(true);
    }
  };

  const clearWorkspace = () => {
    if (workspaceRef.current) {
      // Simple confirmation using a state would be better, but for now we'll just clear
      // or use a simple check.
      if (workspaceRef.current.getAllBlocks(false).length > 0) {
        workspaceRef.current.clear();
      }
    }
  };

  const filteredToolbox = useMemo(() => {
    if (!searchQuery.trim()) return toolbox;

    const query = searchQuery.toLowerCase();
    const searchResults: any[] = [];

    // Flatten all blocks from all categories and filter them
    toolbox.contents.forEach((category: any) => {
      if (category.contents) {
        category.contents.forEach((block: any) => {
          const type = block.type.toLowerCase();
          // We can also try to match against the block's display name if we had a mapping,
          // but matching against the type is a good start.
          if (type.includes(query) || category.name.toLowerCase().includes(query)) {
            searchResults.push(block);
          }
        });
      }
    });

    if (searchResults.length === 0) return toolbox;

    // Create a new toolbox with a "Search Results" category at the top
    return {
      kind: 'categoryToolbox',
      contents: [
        {
          kind: 'category',
          name: '🔍 Results',
          colour: '0',
          contents: searchResults.slice(0, 20) // Limit results for performance
        },
        ...toolbox.contents
      ]
    };
  }, [searchQuery]);

  return (
    <div className="h-full w-full border-4 border-slate-200 rounded-xl overflow-hidden shadow-lg bg-white relative flex flex-col">
      {/* Toolbar */}
      <div className="absolute top-4 right-4 z-10 flex gap-2 items-center">
        {/* Search Bar */}
        <div className="relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Search blocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-48 transition-all text-sm"
          />
        </div>

        <div className="h-8 w-[1px] bg-slate-200 mx-1" />

        <button
          onClick={undo}
          className="p-2 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg shadow-md hover:bg-slate-50 text-slate-600 transition-all active:scale-95"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={18} />
        </button>
        <button
          onClick={redo}
          className="p-2 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg shadow-md hover:bg-slate-50 text-slate-600 transition-all active:scale-95"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={18} />
        </button>

        <div className="h-8 w-[1px] bg-slate-200 mx-1" />

        <button
          onClick={clearWorkspace}
          className="p-2 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg shadow-md hover:bg-red-50 text-red-500 transition-all active:scale-95"
          title="Clear Workspace"
        >
          <Trash2 size={18} />
        </button>

        {onReset && (
          <>
            <div className="h-8 w-[1px] bg-slate-200 mx-1" />
            <button
              onClick={onReset}
              className="p-2 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg shadow-md hover:bg-slate-50 text-slate-600 transition-all active:scale-95"
              title="Reset Game"
            >
              <RotateCcw size={18} />
            </button>
          </>
        )}
      </div>

      <div className="flex-1 relative">
        <BlocklyWorkspace
          toolboxConfiguration={filteredToolbox}
          className="h-full w-full"
          onWorkspaceChange={handleWorkspaceChange}
          workspaceConfiguration={{
            grid: {
              spacing: 20,
              length: 3,
              colour: '#ccc',
              snap: true,
            },
            zoom: {
              controls: true,
              wheel: true,
              startScale: 1.0,
              maxScale: 3,
              minScale: 0.3,
              scaleSpeed: 1.2,
            },
          }}
        />
      </div>
    </div>
  );
};

export default BlocklyEditor;
