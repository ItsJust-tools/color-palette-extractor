'use client';

import Link from 'next/link';

export function ToolToolbar() {
  return (
    <div className="palette-toolbar">
      <Link href="/help" className="toolbar-btn toolbar-help-link" aria-label="Open help page">
        Help
      </Link>
    </div>
  );
}

export default ToolToolbar;
