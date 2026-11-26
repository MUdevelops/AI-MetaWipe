// Single source of truth for the 12 tools and their categories. Every id maps to an existing component in App.jsx.
export const CATS = [
  { id: 'workspace', label: 'Workspace', accent: 'cyan' },
  { id: 'analyze', label: 'Analyze', accent: 'blue' },
  { id: 'clean', label: 'Clean & Edit', accent: 'rose' },
  { id: 'optimize', label: 'Optimize', accent: 'green' },
  { id: 'privacy', label: 'Privacy & Security', accent: 'amber' },
  { id: 'ai', label: 'AI Intelligence', accent: 'violet' },
]

export const TOOLS = [
  { id: 'library', n: '01', cat: 'workspace', icon: 'folder', name: 'Media Library', desc: 'Import images or whole folders, preview thumbnails and manage your workspace.', features: ['Import images and drag and drop', 'Import folders', 'Thumbnails and privacy scores', 'Select, remove or clear images'] },
  { id: 'viewer', n: '02', cat: 'analyze', icon: 'eye', name: 'Metadata Viewer', desc: 'See every readable field: EXIF, GPS, IPTC, XMP and PNG text chunks.', features: ['EXIF viewer', 'GPS location with map link', 'IPTC and XMP', 'PNG text chunks and inspector', 'TXT and JSON export'] },
  { id: 'compare', n: '03', cat: 'analyze', icon: 'compare', name: 'Compare Images', desc: 'Put the metadata of two images side by side and highlight what differs.', features: ['Two-image comparison', 'Highlighted differences', 'Fields unique to each image'] },
  { id: 'remove', n: '04', cat: 'clean', icon: 'eraser', name: 'Remove Metadata', desc: 'Choose exactly what to remove, for one image or a whole batch.', features: ['EXIF, GPS, thumbnail', 'IPTC, XMP, PNG text, C2PA, comments', 'Selective and batch cleanup', 'Download as ZIP'] },
  { id: 'editor', n: '05', cat: 'clean', icon: 'pencil', name: 'Metadata Editor', desc: 'Write your own title, author, copyright, keywords and custom fields.', features: ['Title, author, copyright, description', 'Keywords and dates', 'Custom fields', 'Reusable templates'] },
  { id: 'optimize', n: '06', cat: 'optimize', icon: 'sliders', name: 'Compress, Convert & Resize', desc: 'Shrink PNGs, convert between PNG, JPG and WebP, and resize.', features: ['PNG compression', 'PNG to JPG and JPG to PNG', 'WebP conversion', 'Resize with quality controls'] },
  { id: 'crop', n: '07', cat: 'optimize', icon: 'crop', name: 'Crop Studio', desc: 'Drag to crop with aspect presets or type exact pixel values.', features: ['Interactive cropping', 'Aspect ratio presets', 'Exact pixel dimensions', 'Result preview'] },
  { id: 'background', n: '08', cat: 'optimize', icon: 'layers', name: 'Background & Alpha', desc: 'Make plain backgrounds transparent and verify real transparency.', features: ['Plain-background removal', 'Transparency creation', 'Alpha channel inspection', 'Pixel transparency check'] },
  { id: 'palette', n: '09', cat: 'optimize', icon: 'palette', name: 'Color Palette', desc: 'Extract dominant colours with HEX codes ready for CSS.', features: ['Dominant colours', 'HEX values', 'CSS variables', 'JSON export'] },
  { id: 'duplicates', n: '10', cat: 'optimize', icon: 'copy', name: 'Duplicate Finder', desc: 'Find identical and near-identical images in your workspace.', features: ['Identical files', 'Near-identical pictures', 'Side-by-side groups', 'Remove extras from the list'] },
  { id: 'privacy', n: '11', cat: 'privacy', icon: 'shield', name: 'Privacy Center', desc: 'Score the privacy risk, scan for hidden data, then sanitize and verify.', features: ['Risk analysis and score', 'GPS alerts', 'Hidden metadata scan', 'Sanitize with before and after', 'Integrity check'] },
  { id: 'agent', n: '12', cat: 'ai', icon: 'bot', name: 'AI Metadata Agent', desc: 'Ask questions about your metadata and approve suggested clean-up actions.', features: ['Explains hidden information', 'Privacy recommendations', 'Suggested actions', 'Approve before anything runs'] },
]

export const toolById = (id) => TOOLS.find((t) => t.id === id)
