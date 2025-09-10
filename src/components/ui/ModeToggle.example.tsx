/**
 * Mode Toggle Examples
 * Demonstrates different variations of the mode toggle component
 */

import React from 'react';
import ModeToggle, { CompactModeToggle, FullModeToggle } from './ModeToggle';

const ModeToggleExamples: React.FC = () => {
  return (
    <div className="space-y-8 p-6">
      <h2 className="text-2xl font-bold text-white">Mode Toggle Examples</h2>
      
      {/* Default Mode Toggle */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-300">Default Mode Toggle</h3>
        <div className="p-4 bg-gray-800 rounded-lg">
          <ModeToggle />
        </div>
      </div>

      {/* Compact Version for Header */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-300">Compact Version (for header/nav)</h3>
        <div className="p-4 bg-gray-800 rounded-lg">
          <CompactModeToggle />
        </div>
      </div>

      {/* Full-featured Version */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-300">Full Version (for settings)</h3>
        <div className="p-4 bg-gray-800 rounded-lg">
          <FullModeToggle />
        </div>
      </div>

      {/* Different Sizes */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-300">Different Sizes</h3>
        <div className="p-4 bg-gray-800 rounded-lg space-y-4">
          <div>
            <p className="text-sm text-gray-400 mb-2">Small</p>
            <ModeToggle size="sm" />
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-2">Medium (default)</p>
            <ModeToggle size="md" />
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-2">Large</p>
            <ModeToggle size="lg" />
          </div>
        </div>
      </div>

      {/* Without Labels */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-300">Without Labels</h3>
        <div className="p-4 bg-gray-800 rounded-lg">
          <ModeToggle showLabels={false} />
        </div>
      </div>

      {/* Without Tooltip */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-300">Without Tooltip</h3>
        <div className="p-4 bg-gray-800 rounded-lg">
          <ModeToggle showTooltip={false} />
        </div>
      </div>
    </div>
  );
};

export default ModeToggleExamples;