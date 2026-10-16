/*
 * shared guidebook defaults, editor state, and DOM/bridge helpers
 */
'use strict';

// constants
const COLORS16 = [
    '000000',
    '0000AA',
    '00AA00',
    '00AAAA',
    'AA0000',
    'AA00AA',
    'FFAA00',
    'AAAAAA',
    '555555',
    '5555FF',
    '55FF55',
    '55FFFF',
    'FF5555',
    'FF55FF',
    'FFFF55',
    'FFFFFF'
];
const PAGE_TYPES = [
    ['patchouli:text', 'Text'],
    ['patchouli:image', 'Image'],
    ['patchouli:crafting', 'Crafting Recipe'],
    ['patchouli:smelting', 'Smelting Recipe'],
    ['patchouli:multiblock', 'Multiblock'],
    ['patchouli:entity', 'Entity'],
    ['patchouli:spotlight', 'Item Spotlight'],
    ['patchouli:link', 'Link'],
    ['patchouli:relations', 'Relations'],
    ['patchouli:quest', 'Quest'],
    ['patchouli:empty', 'Empty']
];
const BOOK_COLORS = ['brown', 'blue', 'cyan', 'gray', 'green', 'purple', 'red'];
const ENTRIES_FIRST_SPREAD = 11;
const ENTRIES_PER_PAGE = 13;

function defaults() {
    return {
        bookName: '',
        landingText: 'Welcome to the guide book!',
        subtitle: '',
        version: '0',
        pamphlet: false,
        creativeTab: 'TOOLS',
        model: 'patchouli:book_brown',
        bookTexture: 'patchouli:textures/gui/book_brown.png',
        fillerTexture: '',
        craftingTexture: '',
        openSound: '',
        flipSound: '',
        indexIcon: 'minecraft:writable_book',
        showProgress: true,
        advancementsTab: '',
        showToasts: true,
        useBlockyFont: false,
        pauseGame: false,
        textOverflowMode: 'overflow',
        textColor: '000000',
        headerColor: '333333',
        nameplateColor: 'FFDD00',
        linkColor: '0000EE',
        linkHoverColor: '8800EE',
        progressBarColor: 'FFFF55',
        progressBarBackground: 'DDDDDD',
        giveOnFirstJoin: false,
        hasRecipe: true,
        recipeType: 'shapeless',
        recipeIngredients: ['minecraft:book', 'minecraft:paper'],
        recipePattern: [],
        categories: [],
        entries: []
    };
}

function newMultiblock() {
    return {
        pattern: [['   ', '   ', '  0']],
        mapping: {},
        symmetrical: true,
        offset: []
    };
}

function newPage(type) {
    const page = {
        type: type || 'patchouli:text',
        advancement: '',
        title: '',
        text: '',
        images: [],
        border: false,
        recipe: '',
        recipe2: '',
        enableVisualize: true,
        multiblock: null,
        entity: '',
        scale: 1,
        offset: 0,
        rotate: true,
        defaultRotation: -45,
        name: '',
        item: '',
        linkRecipe: false,
        url: '',
        linkText: '',
        entries: [],
        trigger: '',
        drawFiller: true,
        customVariables: {}
    };
    if (page.type === 'patchouli:multiblock') {
        page.name = 'Multiblock';
        page.multiblock = newMultiblock();
    }
    if (page.type === 'patchouli:entity') {
        page.entity = 'minecraft:pig';
    }
    if (page.type === 'patchouli:link') {
        page.url = 'https://';
        page.linkText = 'Click Here';
    }
    return page;
}

function newEntry(id, categoryId) {
    return {
        id,
        name: 'New Entry',
        category: categoryId,
        icon: 'minecraft:book',
        pages: [newPage('patchouli:text')],
        advancement: '',
        priority: false,
        secret: false,
        readByDefault: false,
        sortnum: 0,
        turnin: '',
        entryColor: '',
        extraRecipeMappings: {}
    };
}

function newCategory(id) {
    return {
        id,
        name: 'New Category',
        description: '',
        icon: 'minecraft:book',
        parent: '',
        sortnum: 0,
        secret: false
    };
}

function normalize(source) {
    const book = Object.assign(defaults(), source || {});
    book.recipeIngredients = book.recipeIngredients || [];
    book.categories = (book.categories || []).map(c => Object.assign(newCategory(''), c));
    book.entries = (book.entries || []).map(e => {
        const ne = Object.assign(newEntry('', ''), e);
        ne.pages = (e.pages || []).map(p => {
            const np = Object.assign(newPage(p.type), p);
            np.images = np.images || [];
            np.entries = np.entries || [];
            np.customVariables = np.customVariables || {};
            return np;
        });
        return ne;
    });
    return book;
}

// state
let gb = defaults();
let view = { mode: 'landing', cat: '', entry: '', spread: 0 };
let sel = { kind: 'book', page: -1 };
let editing = null;
let recipeSlot = 0;
let mb = { page: null, layer: 0, paint: 'A' };

// helpers
const $ = id => document.getElementById(id);

function h(tag, className, properties, ...children) {
    const element = document.createElement(tag);
    if (className) {
        element.className = className;
    }
    for (const k in properties) {
        const v = properties[k];
        if (k === 'text') {
            element.textContent = v;
        } else if (k === 'style') {
            element.style.cssText = v;
        } else if (k.startsWith('on')) {
            element.addEventListener(k.slice(2), v);
        } else if (k === 'value' || k === 'checked' || k === 'disabled') {
            element[k] = v;
        } else {
            element.setAttribute(k, v);
        }
    }
    for (const c of children) {
        if (c != null) {
            element.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        }
    }
    return element;
}

function put(parent, className, x, y, width, height) {
    const element = h('div', className);
    element.style.left = x + 'px';
    element.style.top = y + 'px';
    if (width != null) {
        element.style.width = width + 'px';
    }
    if (height != null) {
        element.style.height = height + 'px';
    }
    parent.appendChild(element);
    return element;
}

function hex6(value) {
    value = String(value || '')
        .replace('#', '')
        .trim();
    if (/^[0-9a-f]{3}$/i.test(value)) {
        value = value.replace(/./g, '$&$&');
    }
    return /^[0-9a-f]{6}$/i.test(value) ? value : '000000';
}

function bare(id) {
    id = id || '';
    return id.slice(id.indexOf(':') + 1);
}

function sanitizeId(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9_\-\/.]/g, '_');
}

function uniqueId(base, list) {
    let id = base;
    let suffix = 2;
    while (list.some(x => x.id === id)) {
        id = base + '_' + suffix++;
    }
    return id;
}

function fromBridge(method, fallback, ...args) {
    try {
        if (window.javabridge) {
            const result = window.javabridge[method](...args);
            if (result) {
                return result;
            }
        }
    } catch (e) {
        /* ignore */
    }
    return fallback;
}
const modId = () => fromBridge('getWorkspaceModId', 'modid');

function hue(text) {
    let hash = 7;
    for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return hash % 360;
}

function abbr(id) {
    return bare(String(id || '').replace(/^#/, ''))
        .replace(/\[.*$/, '')
        .replace(/[^a-z0-9]/gi, '')
        .slice(0, 2);
}

function iconURI(id) {
    id = String(id || '').replace(/\[.*$/, '');
    if (!id) {
        return '';
    }
    try {
        if (window.javabridge && typeof window.javabridge.getMCItemURI === 'function') {
            const uri = window.javabridge.getMCItemURI(id);
            if (uri) {
                return uri;
            }
        }
    } catch (e) {
        /* ignore */
    }
    return '';
}

function textureName(location) {
    return String(location || '').split(/[\\/:]/).pop().replace(/\.png$/i, '');
}

const screenTextureURI = location => location ? fromBridge('getScreenTextureURI', '', location) : '';

function applyIcon(element, value) {
    element.textContent = '';
    element.style.background = '';
    element.style.backgroundImage = '';
    if (!value) {
        return element;
    }
    const uri = iconURI(value);
    if (uri) {
        element.classList.add('has-icon');
        element.style.backgroundImage = 'url("' + uri + '")';
    } else {
        element.textContent = abbr(value);
        element.style.background = 'hsl(' + hue(bare(value)) + ',45%,38%)';
    }
    return element;
}

function blockBg(element, value) {
    const uri = iconURI(value);
    if (uri) {
        Object.assign(element.style, {
            backgroundImage: 'url("' + uri + '")',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundColor: '#8b8b8b'
        });
    } else {
        element.style.background = 'hsl(' + hue(bare(value || '')) + ',45%,38%)';
    }
}
const icoEl = (value, cls) => applyIcon(h('div', cls || 'ico'), value);
const byName = (a, b) => (a.name || '').localeCompare(b.name || '');

// fake unlock progress preview

function previewReadState(entry) {
    return !entry.readByDefault ? 0 : entry.turnin ? 1 : 2;
}

function sortedEntries(catId) {
    return gb.entries
        .filter(e => bare(e.category) === bare(catId))
        .sort(
            (a, b) =>
                previewReadState(a) - previewReadState(b) ||
                (b.priority ? 1 : 0) - (a.priority ? 1 : 0) ||
                a.sortnum - b.sortnum ||
                byName(a, b)
        );
}

function childCats(parent) {
    return gb.categories
        .filter(c => bare(c.parent) === bare(parent))
        .sort((a, b) => a.sortnum - b.sortnum || byName(a, b));
}
const findCat = id => gb.categories.find(c => c.id === id);
const findEntry = id => gb.entries.find(e => e.id === id);
const curEntry = () => (view.mode === 'entry' ? findEntry(view.entry) : null);

function canSetCategoryParent(category, parentId) {
    const visited = new Set([category.id]);
    let parent = findCat(bare(parentId));
    while (parent) {
        if (visited.has(parent.id)) {
            return false;
        }
        visited.add(parent.id);
        parent = findCat(bare(parent.parent));
    }
    return true;
}

function multiblockHasCenter(multiblock) {
    let centers = 0;
    for (const layer of multiblock?.pattern || []) {
        for (const row of layer || []) {
            for (const ch of row || '') {
                if (ch === '0') {
                    centers++;
                }
            }
        }
    }
    return centers === 1;
}

function pickItem(onPick) {
    if (window.javabridge && typeof window.javabridge.openMCItemSelector === 'function') {
        window.javabridge.openMCItemSelector({
            callback: item => {
                if (item) {
                    onPick(String(item));
                }
            }
        });
        return;
    }
    const modal = $('itemModal');
    const input = $('itemModalInput');
    input.value = '';
    modal.classList.remove('hidden');
    input.focus();
    $('itemModalOk').onclick = () => {
        modal.classList.add('hidden');
        if (input.value.trim()) {
            onPick(input.value.trim());
        }
    };
    $('itemModalCancel').onclick = () => modal.classList.add('hidden');
}

function showPopup(event, items) {
    const popup = $('popup');
    popup.innerHTML = '';
    items.forEach(it =>
        popup.appendChild(
            h('div', 'pi', {
                text: it.label,
                onclick: () => {
                    hidePopup();
                    it.run();
                }
            })
        )
    );
    popup.classList.remove('hidden');
    const bounds = popup.getBoundingClientRect();
    popup.style.left = Math.min(event.clientX, window.innerWidth - bounds.width - 6) + 'px';
    popup.style.top = Math.min(event.clientY, window.innerHeight - bounds.height - 6) + 'px';
}

function hidePopup() {
    $('popup').classList.add('hidden');
}

function dangerBtn(label, onConfirm) {
    const button = h('button', 'btn danger small', { text: label });
    let armed = false;
    button.addEventListener('click', () => {
        if (armed) {
            return onConfirm();
        }
        armed = true;
        button.textContent = 'Click again to confirm';
        setTimeout(() => {
            armed = false;
            button.textContent = label;
        }, 2500);
    });
    return button;
}