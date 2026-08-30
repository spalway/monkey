// The token's contract address, as one click-to-copy control.
//
// Renders nothing at all when no address is configured. A launch page that
// shows an empty or placeholder CA box teaches people to copy whatever is in
// it, which is exactly the habit an impersonator relies on — better to have no
// box until there is a real address to put in it.

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function TokenAddress({ mint, label = 'Contract address' }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const id = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(id);
  }, [copied]);

  if (!mint) return null;

  return (
    <button
      className="ca"
      type="button"
      title={`Copy ${mint}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(mint);
          setCopied(true);
        } catch {
          // Clipboard denied (insecure origin, or refused). The address is
          // still on screen and selectable, so say nothing rather than
          // interrupting with a dialog.
        }
      }}
    >
      <span className="ca-label">{label}</span>
      <span className="ca-value">{mint}</span>
      <span className="ca-icon">
        {copied ? <Check size={13} strokeWidth={2.6} /> : <Copy size={13} strokeWidth={2.2} />}
        {copied ? 'Copied' : 'Copy'}
      </span>
    </button>
  );
}
