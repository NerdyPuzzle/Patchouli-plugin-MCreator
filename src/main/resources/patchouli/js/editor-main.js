/*
 * multiblock designer, guidebook serialization, and editor startup
 */
'use strict';

// multiblock designer

function openMultiblock(page) {
    if (!page.multiblock) {
        page.multiblock = newMultiblock();
    }
    if (!page.multiblock.mapping) {
        page.multiblock.mapping = {};
    }
    mb = { page: page, layer: 0, paint: Object.keys(page.multiblock.mapping)[0] || '_', layerOnly: false };
    $('mbModal').classList.remove('hidden');
    renderMb();
}

function mbDims(multiblock) {
    const layers = multiblock.pattern.length;
    const rows = layers ? multiblock.pattern[0].length : 0;
    const cols = rows ? multiblock.pattern[0][0].length : 0;
    return { layers, rows, cols };
}

function mbResize(multiblock, layerCount, rowCount, columnCount) {
    multiblock.pattern = Array.from({ length: layerCount }, (_, l) =>
        Array.from({ length: rowCount }, (_, r) =>
            ((multiblock.pattern[l] && multiblock.pattern[l][r]) || '')
                .slice(0, columnCount)
                .padEnd(columnCount, ' ')
        )
    );
}

function clearChar(multiblock, character) {
    multiblock.pattern = multiblock.pattern.map(l => l.map(row => row.split(character).join(' ')));
}

// flat SVG faces give the blocks their isometric shape
function mbIsometric(multiblock, selectedLayer = -1, layerOnly = false, onSelectLayer) {
    const { layers, rows, cols } = mbDims(multiblock);
    const mapping = multiblock.mapping || {};
    const unit = 24;
    const padding = 16;
    const svg = (tag, attributes, text) => {
        const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const key in attributes) {
            element.setAttribute(key, attributes[key]);
        }
        if (text != null) {
            element.textContent = text;
        }
        return element;
    };
    const project = (x, z, y) => [
        (z - x + rows) * unit + padding,
        (x + z) * unit / 2 + (layers - y) * unit + padding
    ];
    const points = vertices => vertices.map(p => p.join(',')).join(' ');
    const width = Math.max(1, (rows + cols) * unit + padding * 2);
    const height = Math.max(1, (rows + cols) * unit / 2 + layers * unit + padding * 2);
    const scene = svg('svg', {
        class: 'mb-isometric', viewBox: '0 0 ' + width + ' ' + height,
        role: 'img', 'aria-label': layerOnly ? 'Isometric preview of the selected layer' : 'Isometric preview of the multiblock'
    });
    scene.appendChild(svg('title', {}, 'Multiblock preview'));

    // ground grid makes empty cells easier to see
    const floor = svg('g', { class: 'mb-iso-floor' });
    floor.appendChild(svg('polygon', {
        points: points([project(0, 0, 0), project(rows, 0, 0), project(rows, cols, 0), project(0, cols, 0)])
    }));
    for (let r = 0; r <= rows; r++) {
        floor.appendChild(svg('polyline', { points: points([project(r, 0, 0), project(r, cols, 0)]) }));
    }
    for (let c = 0; c <= cols; c++) {
        floor.appendChild(svg('polyline', { points: points([project(0, c, 0), project(rows, c, 0)]) }));
    }
    scene.appendChild(floor);

    const characterAt = (l, r, c) => {
        if (layerOnly && l !== selectedLayer) {
            return ' ';
        }
        return multiblock.pattern[l]?.[r]?.[c] || ' ';
    };
    const solidAt = (l, r, c) => {
        const ch = characterAt(l, r, c);
        return ch !== ' ' && ch !== '_' && (ch !== '0' || !!mapping['0']);
    };
    const blocks = [];
    for (let l = 0; l < layers; l++) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const ch = characterAt(l, r, c);
                if (ch !== ' ') {
                    blocks.push({ l, r, c, ch, y: layers - l - 1 });
                }
            }
        }
    }
    // draw far blocks first, including the lower layers
    blocks.sort((a, b) => (a.r + a.c + a.y) - (b.r + b.c + b.y) || b.l - a.l || a.r - b.r);
    for (const { l, r, c, ch, y } of blocks) {
        const topVisible = !solidAt(l - 1, r, c);
        const leftVisible = !solidAt(l, r + 1, c);
        const rightVisible = !solidAt(l, r, c + 1);
        if (!topVisible && !leftVisible && !rightVisible) {
            continue;
        }
        const value = mapping[ch] || ch;
        const ghost = ch === '_' || (ch === '0' && !mapping['0']);
        const group = svg('g', {
            class: 'mb-iso-block' + (ghost ? ' ghost' : '') + (ch === '0' ? ' center' : '') +
                (l === selectedLayer ? ' current' : ''),
            'data-layer': l, 'data-row': r, 'data-column': c,
            style: '--block-hue:' + hue(bare(value))
        });
        const name = ch === '_' ? 'Any block' : ch === '0' ? 'Center' : value;
        group.appendChild(svg('title', {}, name + ' (' + (l === 0 ? 'Top' : 'L' + (l + 1)) + ', row ' + (r + 1) + ', column ' + (c + 1) + ')'));
        const face = (className, vertices) => group.appendChild(svg('polygon', { class: className, points: points(vertices) }));
        const back = project(r, c, y + 1);
        const right = project(r, c + 1, y + 1);
        const front = project(r + 1, c + 1, y + 1);
        const left = project(r + 1, c, y + 1);
        if (leftVisible) {
            face('mb-iso-left', [left, front, project(r + 1, c + 1, y), project(r + 1, c, y)]);
        }
        if (rightVisible) {
            face('mb-iso-right', [front, right, project(r, c + 1, y), project(r + 1, c + 1, y)]);
        }
        if (topVisible) {
            face('mb-iso-top', [back, right, front, left]);
            const label = project(r + 0.5, c + 0.5, y + 1);
            group.appendChild(svg('text', { x: label[0], y: label[1], class: 'mb-iso-label' }, ch));
        }
        if (onSelectLayer) {
            group.addEventListener('click', () => onSelectLayer(l));
        }
        scene.appendChild(group);
    }
    return scene;
}

function renderMbPreview() {
    const preview = $('mbPreview');
    if (!preview) {
        return;
    }
    preview.replaceChildren(mbIsometric(mb.page.multiblock, mb.layer, mb.layerOnly, l => {
        mb.layer = l;
        renderMb();
    }));
}

function renderMb() {
    const body = $('mbBody');
    body.textContent = '';
    const multiblock = mb.page.multiblock;
    const hasCenter = multiblockHasCenter(multiblock);
    $('mbClose').disabled = !hasCenter;
    const dimensions = mbDims(multiblock);
    if (mb.layer >= dimensions.layers) {
        mb.layer = Math.max(0, dimensions.layers - 1);
    }
    const palettePanel = h('div', 'mb-side');
    const gridPanel = h('div', 'mb-main');
    body.appendChild(h('div', 'mb-layout', null, palettePanel, gridPanel));

    // dimensions
    const [layerInput, rowInput, columnInput] = [
        dimensions.layers,
        dimensions.rows,
        dimensions.cols
    ].map(value =>
        h('input', null, { type: 'number', min: 1, max: 24, value, style: 'width:56px' })
    );
    const apply = () => {
        const c = v => Math.max(1, Math.min(24, parseInt(v.value, 10) || 1));
        mbResize(multiblock, c(layerInput), c(rowInput), c(columnInput));
        renderMb();
    };
    palettePanel.appendChild(
        fld(
            'Layers (top \u2192 bottom) \u00D7 rows \u00D7 columns',
            h(
                'div',
                'row',
                null,
                layerInput,
                rowInput,
                columnInput,
                h('button', 'btn small', { text: 'Apply', onclick: apply })
            )
        )
    );
    palettePanel.appendChild(checkF('Symmetrical', multiblock, 'symmetrical'));
    if (!hasCenter) {
        palettePanel.appendChild(h('div', 'ins-hint mb-center-warning', {
            role: 'alert',
            text: 'Set one center before saving: choose Center (0) in the palette and click a grid cell.'
        }));
    }

    // palette
    palettePanel.appendChild(
        h('div', 'ins-title', { text: 'Palette (click to paint, right-click a cell to erase)' })
    );
    const addPaletteEntry = (ch, label, custom) => {
        const r = h('div', 'mb-pal' + (mb.paint === ch ? ' active' : ''));
        const c = h('div', 'ch', { text: ch === ' ' ? '\u2423' : ch });
        if (custom) {
            blockBg(c, multiblock.mapping[ch] || ch);
        }
        r.appendChild(c);
        if (custom) {
            const inp = h('input', null, {
                type: 'text',
                value: multiblock.mapping[ch] || '',
                placeholder: 'minecraft:stone[state=value]'
            });
            inp.addEventListener('input', () => {
                multiblock.mapping[ch] = inp.value;
                renderMbPreview();
            });
            inp.addEventListener('change', renderMb);
            inp.addEventListener('click', ev => ev.stopPropagation());
            r.appendChild(inp);
            r.appendChild(
                h('button', 'btn small', {
                    text: 'Pick',
                    onclick: ev => {
                        ev.stopPropagation();
                        pickItem(v => {
                            multiblock.mapping[ch] = v;
                            renderMb();
                        });
                    }
                })
            );
            r.appendChild(
                h('button', 'btn small', {
                    text: '\u2715',
                    onclick: ev => {
                        ev.stopPropagation();
                        delete multiblock.mapping[ch];
                        clearChar(multiblock, ch);
                        mb.paint = '_';
                        renderMb();
                    }
                })
            );
        } else {
            r.appendChild(h('span', null, { text: label }));
        }
        r.addEventListener('click', () => {
            mb.paint = ch;
            renderMb();
        });
        palettePanel.appendChild(r);
    };
    addPaletteEntry(' ', 'Air');
    addPaletteEntry('_', 'Any block');
    addPaletteEntry('0', 'Center (player cursor)');
    Object.keys(multiblock.mapping)
        .filter(k => k !== '0')
        .forEach(k => addPaletteEntry(k, '', true));
    palettePanel.appendChild(
        h('button', 'btn small', {
            text: '+ Block type',
            onclick: () => {
                const ch = [
                    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789'
                ].find(c => !(c in multiblock.mapping));
                if (!ch) {
                    return;
                }
                multiblock.mapping[ch] = 'minecraft:stone';
                mb.paint = ch;
                renderMb();
            }
        })
    );

    // full structure above the layer we're painting
    const layerOnly = h('input', null, { type: 'checkbox', checked: mb.layerOnly });
    layerOnly.addEventListener('change', () => {
        mb.layerOnly = layerOnly.checked;
        renderMbPreview();
    });
    gridPanel.appendChild(h('div', 'mb-preview-head', null,
        h('span', 'ins-title', { text: 'Structure preview' }),
        h('label', 'mb-layer-toggle', null, layerOnly, 'Current layer only')
    ));
    gridPanel.appendChild(h('div', 'mb-preview', { id: 'mbPreview' }));
    gridPanel.appendChild(h('div', 'ins-hint', { text: 'Click a block to edit its layer. Paint in the grid below.' }));
    renderMbPreview();

    // layers + grid
    const tabs = h('div', 'layer-tabs');
    for (let l = 0; l < dimensions.layers; l++) {
        tabs.appendChild(
            h('button', 'btn small' + (l === mb.layer ? ' active' : ''), {
                text: l === 0 ? 'Top' : 'L' + (l + 1),
                onclick: () => {
                    mb.layer = l;
                    renderMb();
                }
            })
        );
    }
    gridPanel.appendChild(tabs);
    const grid = h('div', 'mb-grid');
    grid.style.gridTemplateColumns = 'repeat(' + dimensions.cols + ', 28px)';
    const layer = multiblock.pattern[mb.layer] || [];
    const special = { ' ': ['air', 'Air'], '_': ['any', 'Any'], '0': ['center', 'Center'] };
    for (let r = 0; r < dimensions.rows; r++) {
        for (let c = 0; c < dimensions.cols; c++) {
            const ch = layer[r][c];
            const sp = special[ch];
            const cell = h('div', 'mb-cell' + (sp ? ' ' + sp[0] : ''), {
                text: ch === ' ' ? '' : ch,
                title: sp ? sp[1] : multiblock.mapping[ch] || ch
            });
            if (!sp) {
                blockBg(cell, multiblock.mapping[ch] || ch);
            }
            const paint = v => {
                if (v === '0') {
                    clearChar(multiblock, '0');
                } // there can be only one (center)
                const row = multiblock.pattern[mb.layer][r];
                multiblock.pattern[mb.layer][r] = row.slice(0, c) + v + row.slice(c + 1);
                renderMb();
            };
            cell.addEventListener('click', () => paint(mb.paint));
            cell.addEventListener('contextmenu', ev => {
                ev.preventDefault();
                paint(' ');
            });
            grid.appendChild(cell);
        }
    }
    gridPanel.appendChild(grid);
}

// boot

function renderAll() {
    renderBreadcrumb();
    renderBook();
    renderInspector();
}

function b64ToStr(base64) {
    return new TextDecoder('utf-8').decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0)));
}

function strToB64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}
async function preloadImages(book) {
    if (!window.javabridge) return;
    const locations = new Set(book.entries.flatMap(entry => entry.pages
        .filter(page => page.type === 'patchouli:image').flatMap(page => page.images)).filter(Boolean));
    for (const location of locations) {
        if (gb !== book) return;
        const source = await new Promise(resolve =>
            window.javabridge.preloadScreenTexture(location, { callback: resolve }));
        if (source) {
            const image = new Image();
            image.src = source;
            await image.decode().catch(() => {});
        }
    }
}

window.loadGuidebookBase64 = function (b64) {
    try {
        gb = normalize(JSON.parse(b64ToStr(b64)));
    } catch (e) {
        console.error('load failed', e);
        gb = normalize({});
    }
    view = { mode: 'landing', cat: '', entry: '', spread: 0 };
    sel = { kind: 'book', page: -1 };
    renderAll();
    preloadImages(gb);
};
window.getGuidebookBase64 = function () {
    document.activeElement?.commitGuidebookValue?.();
    return strToB64(JSON.stringify(gb));
};
document.addEventListener('DOMContentLoaded', () => {
    buildFormatBar();
    $('mbClose').addEventListener('click', () => {
        if (!multiblockHasCenter(mb.page.multiblock)) {
            return;
        }
        $('mbModal').classList.add('hidden');
        renderAll();
    });
    document.addEventListener('mousedown', ev => {
        if (!ev.target.closest('#popup')) {
            hidePopup();
        }
    });
    window.addEventListener('resize', fit);
    gb = normalize(gb);
    renderAll();
});