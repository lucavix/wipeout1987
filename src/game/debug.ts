/** Tiny DOM panel of sliders bound to numeric fields of objects. Toggle with F1. */
export interface DebugField { obj: Record<string, number>; key: string; min: number; max: number; step?: number; label?: string }

export class DebugPanel {
  private root: HTMLDivElement;
  private fields: DebugField[] = [];
  private inputs: HTMLInputElement[] = [];
  constructor() {
    this.root = document.createElement('div');
    Object.assign(this.root.style, {
      position: 'fixed', top: '60px', left: '16px', padding: '8px 10px', background: 'rgba(6,7,13,0.85)',
      color: '#a9b0c6', font: '12px monospace', border: '1px solid #3a4463', display: 'none', zIndex: '10',
    } as CSSStyleDeclaration);
    document.body.appendChild(this.root);
  }
  add(f: DebugField): this {
    this.fields.push(f);
    const row = document.createElement('div');
    const label = document.createElement('span'); label.style.display = 'inline-block'; label.style.width = '120px';
    const input = document.createElement('input'); input.type = 'range';
    input.min = String(f.min); input.max = String(f.max); input.step = String(f.step ?? (f.max - f.min) / 100);
    input.value = String(f.obj[f.key]); input.style.width = '160px';
    const val = document.createElement('span'); val.style.marginLeft = '8px';
    const refresh = () => { label.textContent = f.label ?? f.key; val.textContent = String(f.obj[f.key]); };
    input.addEventListener('input', () => { f.obj[f.key] = Number(input.value); refresh(); });
    refresh();
    row.append(label, input, val); this.root.appendChild(row); this.inputs.push(input);
    return this;
  }
  toggle(): void { this.root.style.display = this.root.style.display === 'none' ? 'block' : 'none'; }
  get visible(): boolean { return this.root.style.display !== 'none'; }
}
