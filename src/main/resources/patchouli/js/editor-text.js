/*
 * patchouli markup rendering, inline editing and the format bar
 */
'use strict';

// shared helpers
const CARET_MARKER = '\u2060';
const stripZw = s => s.replace(/[\u200b\u2060]/g, '');
const TRAIL_BR_RE = /(\$\(br2?\)|\$\(\)|\s)+$/;
const RGB_RE = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/;
const fireInput = host => host.dispatchEvent(new Event('input'));
const richHost = () => (editing && editing.rich ? editing.host : null);

// Format fields: color, bold, italic, underline, strike, obfuscation, link, tooltip, command.
function plainFmt() {
    return {
        c: hex6(gb.textColor).toUpperCase(),
        b: 0,
        i: 0,
        u: 0,
        s: 0,
        k: 0,
        l: '',
        t: '',
        cm: ''
    };
}

function setRange(range) {
    const selection = window.getSelection();
    selection.removeAllRanges();
    if (range) {
        selection.addRange(range);
    }
}

function setCaret(node, offset) {
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    setRange(range);
}

function makeChip(raw, label, className) {
    return h('span', 'chip' + (className ? ' ' + className : ''), {
        contenteditable: 'false',
        'data-raw': raw,
        text: label
    });
}

// text markup
const MACROS = [
    ['$(obf)', '$(k)'],
    ['$(bold)', '$(l)'],
    ['$(strike)', '$(m)'],
    ['$(italic)', '$(o)'],
    ['$(italics)', '$(o)'],
    ['$(list', '$(li'],
    ['$(reset)', '$()'],
    ['$(clear)', '$()'],
    ['$(2br)', '$(br2)'],
    ['$(p)', '$(br2)'],
    ['/$', '$()'],
    ['<br>', '$(br)'],
    ['$(nocolor)', '$(0)'],
    ['$(item)', '$(#b0b)'],
    ['$(thing)', '$(#490)']
];
const expandMacros = t => MACROS.reduce((s, [k, v]) => s.split(k).join(v), t);

// patchouli flag codes -> format keys
const FLAGS = { k: 'k', l: 'b', m: 's', n: 'u', o: 'i' };

// styling shared by rendered markup and editor spans (everything except color)

function decorate(span, format) {
    if (format.b) {
        span.style.fontWeight = 'bold';
    }
    if (format.i) {
        span.style.fontStyle = 'italic';
    }
    const decoration = [
        (format.u || format.l || format.cm) && 'underline',
        format.s && 'line-through'
    ]
        .filter(Boolean)
        .join(' ');
    if (decoration) {
        span.style.textDecoration = decoration;
    }
    if (format.l) {
        span.dataset.link = format.l;
        span.title = format.l;
    }
    if (format.t) {
        span.classList.add('tip');
        span.dataset.tip = format.t;
        span.title = format.t;
    }
    if (format.cm) {
        span.dataset.cmd = format.cm;
        span.title = format.cm;
    }
    if (format.k) {
        span.classList.add('obf');
        span.dataset.k = '1';
    }
    return span;
}

// Render patchouli markup into formatted DOM so user sees clean output in the editor

function renderMarkup(target, raw, editable) {
    target.textContent = '';
    const parts = expandMacros(raw || '').split(/(\$\([^)]*\))/);
    const baseColor = '#' + hex6(gb.textColor);
    const freshFormat = () => ({
        color: baseColor,
        b: false,
        i: false,
        u: false,
        s: false,
        k: false,
        l: '',
        t: '',
        cm: ''
    });
    let format = freshFormat();
    let container = target;
    const emit = txt => {
        if (!txt) {
            return;
        }
        const sp = document.createElement('span');
        sp.textContent = txt;
        sp.style.color = format.l ? '#' + hex6(gb.linkColor) : format.color;
        container.appendChild(decorate(sp, format));
    };
    const special = (rawCode, label) =>
        editable ? container.appendChild(makeChip(rawCode, label)) : emit(label);
    const newline = () => {
        if (editable) {
            emit('\n');
        } else {
            container = target;
            target.appendChild(document.createElement('br'));
        }
    };
    parts.forEach(part => {
        if (!(part.length >= 3 && part.startsWith('$(') && part.endsWith(')'))) {
            emit(part);
            return;
        }
        const code = part.slice(2, -1);
        let m;
        if (code === '') {
            format = freshFormat();
        } else if (code === 'br') {
            newline();
        } else if (code === 'br2') {
            newline();
            newline();
        } else if ((m = /^li(\d*)$/.exec(code))) {
            container.appendChild(makeLiChip(parseInt(m[1] || '1', 10), part));
        } else if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(code)) {
            format.color = '#' + hex6(code);
        } else if (/^[0-9a-f]$/i.test(code)) {
            format.color = '#' + COLORS16[parseInt(code, 16)];
        } else if (Object.hasOwn(FLAGS, code)) {
            format[FLAGS[code]] = true;
        } else if (code.startsWith('l:')) {
            format.l = code.slice(2) || '?';
        } else if (code === '/l') {
            format.l = '';
        } else if (code.startsWith('t:')) {
            format.t = code.slice(2);
        } else if (code === '/t') {
            format.t = '';
        } else if (code.startsWith('c:')) {
            format.cm = code.slice(2);
        } else if (code === '/c') {
            format.cm = '';
        } else if (code === 'playername') {
            special(part, 'Player');
        } else if (code.startsWith('k:')) {
            special(part, '[' + code.slice(2) + ']');
        } else {
            special(part, part);
        }
    });
}

function cssToHex(value) {
    let match = RGB_RE.exec(value);
    if (match) {
        return match
            .slice(1, 4)
            .map(n => ('0' + parseInt(n, 10).toString(16)).slice(-2))
            .join('')
            .toUpperCase();
    }
    const probe = document.createElement('span');
    probe.style.color = value;
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    return RGB_RE.test(rgb) ? cssToHex(rgb) : hex6(value).toUpperCase();
}

function formatOf(node, root) {
    const format = plainFmt();
    const resolved = { c: false, b: false, i: false };
    for (let el = node.parentElement; el && el !== root; el = el.parentElement) {
        const st = el.style;
        const tag = el.tagName;
        if (!resolved.c) {
            const c = st.color || (tag === 'FONT' ? el.getAttribute('color') : '');
            if (c) {
                format.c = cssToHex(c);
                resolved.c = true;
            }
        }
        if (!resolved.b) {
            if (st.fontWeight) {
                format.b = st.fontWeight === 'bold' || parseInt(st.fontWeight, 10) >= 600 ? 1 : 0;
                resolved.b = true;
            } else if (tag === 'B' || tag === 'STRONG') {
                format.b = 1;
                resolved.b = true;
            }
        }
        if (!resolved.i) {
            if (st.fontStyle) {
                format.i = st.fontStyle === 'italic' ? 1 : 0;
                resolved.i = true;
            } else if (tag === 'I' || tag === 'EM') {
                format.i = 1;
                resolved.i = true;
            }
        }
        const deco = st.textDecorationLine || st.textDecoration || '';
        if (tag === 'U' || deco.includes('underline')) {
            format.u = 1;
        }
        if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL' || deco.includes('line-through')) {
            format.s = 1;
        }
        if (el.dataset.k && !format.k) {
            format.k = 1;
        }
        if (el.dataset.link !== undefined && !format.l) {
            format.l = el.dataset.link;
        }
        if (el.dataset.tip !== undefined && !format.t) {
            format.t = el.dataset.tip;
        }
        if (el.dataset.cmd !== undefined && !format.cm) {
            format.cm = el.dataset.cmd;
        }
    }
    if (format.l || format.cm) {
        format.c = hex6(gb.textColor).toUpperCase();
        format.u = 0;
    } // link styling is presentational only
    return format;
}

function serializeRich(root) {
    const plain = plainFmt();
    let output = '';
    let previousFormat = plain;
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const codes = f =>
        [
            f.c !== plain.c && '$(#' + f.c + ')',
            f.b && '$(l)',
            f.i && '$(o)',
            f.u && '$(n)',
            f.s && '$(m)',
            f.k && '$(k)',
            f.l && '$(l:' + f.l + ')',
            f.t && '$(t:' + f.t + ')',
            f.cm && '$(c:' + f.cm + ')'
        ]
            .filter(Boolean)
            .join('');
    const transition = f => {
        if (same(f, previousFormat)) {
            return;
        }
        if (!same(previousFormat, plain)) {
            output += '$()';
        }
        output += codes(f);
        previousFormat = f;
    };
    const lastNode = root.lastChild;
    const walk = n => {
        n.childNodes.forEach(c => {
            if (c.nodeType === Node.TEXT_NODE) {
                const data = stripZw(c.data);
                if (!data) {
                    return;
                }
                if (data.replace(/\n/g, '')) {
                    transition(formatOf(c, root));
                }
                output += data.replace(/\n/g, '$(br)');
            } else if (c.nodeName === 'BR') {
                if (c !== lastNode) {
                    output += '$(br)';
                }
            } else if (c.dataset && c.dataset.raw) {
                output += c.dataset.raw;
            } else if (c.nodeName === 'DIV' || c.nodeName === 'P') {
                if (output && !/\$\(br\)$/.test(output)) {
                    output += '$(br)';
                }
                walk(c);
            } else {
                walk(c);
            }
        });
    };
    walk(root);
    return output.replace(/(\$\(br\)){2}/g, '$(br2)').replace(TRAIL_BR_RE, ''); // trailing breaks are invisible in the book
}

// inline editing

function insertPlain(text) {
    const selection = window.getSelection();
    if (!selection.rangeCount) {
        return;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    setRange(range);
}

function insertNewline() {
    const selection = window.getSelection();
    if (!selection.rangeCount) {
        return;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const newline = document.createTextNode('\n');
    const caretMarker = document.createTextNode(CARET_MARKER);
    range.insertNode(newline);
    newline.parentNode.insertBefore(caretMarker, newline.nextSibling);
    setCaret(caretMarker, 1);
}

function deleteBackward(host) {
    const selection = window.getSelection();
    if (!selection.rangeCount || !selection.isCollapsed) {
        return false;
    }
    const range = selection.getRangeAt(0);
    const nodes = [];
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        nodes.push(n);
    }
    for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (n.nodeType === 1) {
            if (!n.classList.contains('chip') && n.nodeName !== 'BR') {
                continue;
            }
            if (
                range.comparePoint(
                    n.parentNode,
                    Array.prototype.indexOf.call(n.parentNode.childNodes, n) + 1
                ) <= 0
            ) {
                return false;
            }
            continue;
        }
        if (n.parentElement.closest('.chip') || range.comparePoint(n, 0) >= 0) {
            continue;
        }
        let k = (range.startContainer === n ? range.startOffset : n.data.length) - 1;
        while (k >= 0 && !stripZw(n.data.charAt(k))) {
            k--;
        }
        if (k < 0) {
            continue;
        }
        n.deleteData(k, 1);
        if (n.data) {
            setCaret(n, k);
        } else {
            n.data = CARET_MARKER;
            setCaret(n, 1);
        }
        return true;
    }
    return false;
}

function fmtSpan(format, text) {
    const span = document.createElement('span');
    span.textContent = text;
    span.style.color = '#' + (format.l || format.cm ? hex6(gb.linkColor) : format.c);
    return decorate(span, format);
}

function pruneEmpty(host) {
    host.querySelectorAll('span,font,b,i,u,s,strike,strong,em').forEach(e => {
        if (!e.textContent && !e.querySelector('br,.chip') && !e.dataset.raw) {
            e.remove();
        }
    });
}

function fmtAtCaret(host) {
    const selection = window.getSelection();
    if (!selection.rangeCount) {
        return plainFmt();
    }
    const node = selection.anchorNode;
    if (!node || !host.contains(node)) {
        return plainFmt();
    }
    return formatOf(node.nodeType === 3 ? node : { parentElement: node }, host);
}

function textLeaves(host, range) {
    const leaves = [];
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.parentElement.closest('.chip')) {
            continue;
        }
        if (!stripZw(n.data) || !range.intersectsNode(n)) {
            continue;
        }
        leaves.push(n);
    }
    return leaves;
}

function flagState(host, key) {
    const selection = window.getSelection();
    if (!selection.rangeCount || !host.contains(selection.anchorNode)) {
        return false;
    }
    if (selection.isCollapsed) {
        return !!fmtAtCaret(host)[key];
    }
    const leaves = textLeaves(host, selection.getRangeAt(0));
    return leaves.length > 0 && leaves.every(n => formatOf(n, host)[key]);
}

function typeAs(host, format) {
    breakOut(host);
    const caretMarker = window.getSelection().anchorNode;
    if (JSON.stringify(format) === JSON.stringify(plainFmt())) {
        return;
    }
    const span = fmtSpan(format, '');
    caretMarker.parentNode.insertBefore(span, caretMarker);
    span.appendChild(caretMarker);
    setCaret(caretMarker, 1);
}

function restyle(key, mutate) {
    const host = richHost();
    if (!host) {
        return;
    }
    host.focus();
    const selection = window.getSelection();
    if (!selection.rangeCount) {
        return;
    }
    if (selection.isCollapsed) {
        const f = fmtAtCaret(host);
        mutate(f, !!f[key]);
        typeAs(host, f);
    } else {
        const r0 = selection.getRangeAt(0);
        const covered = textLeaves(host, r0);
        const on = key ? covered.length > 0 && covered.every(n => formatOf(n, host)[key]) : false;
        const r = r0.cloneRange();
        const endR = document.createRange();
        endR.setStart(r.endContainer, r.endOffset);
        endR.setEnd(host, host.childNodes.length);
        const rest = endR.extractContents();
        const midR = document.createRange();
        midR.setStart(r.startContainer, r.startOffset);
        midR.setEnd(host, host.childNodes.length);
        const mid = midR.extractContents();
        const out = document.createDocumentFragment();
        const leaves = [];
        const w = document.createTreeWalker(mid, NodeFilter.SHOW_ALL);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
            if (n.nodeType === 3 && !n.parentElement?.closest('.chip')) {
                leaves.push(n);
            } else if (n.nodeType === 1 && (n.classList.contains('chip') || n.nodeName === 'BR')) {
                leaves.push(n);
            }
        }
        let firstT = null;
        let lastT = null;
        leaves.forEach(n => {
            if (n.nodeType !== 3) {
                out.appendChild(n.cloneNode(true));
                return;
            }
            const data = stripZw(n.data);
            if (!data) {
                return;
            }
            const f = formatOf(n, mid);
            mutate(f, on);
            const sp = fmtSpan(f, data);
            out.appendChild(sp);
            firstT = firstT || sp.firstChild;
            lastT = sp.firstChild;
        });
        host.appendChild(out);
        host.appendChild(rest);
        pruneEmpty(host);
        if (firstT) {
            selection.setBaseAndExtent(firstT, 0, lastT, lastT.data.length);
        }
    }
    fireInput(host);
    barRefresh();
}

function toggleFlag(key) {
    restyle(key, (f, on) => {
        f[key] = on ? 0 : 1;
    });
}

function setColor(hex) {
    restyle(null, f => {
        f.c = hex.toUpperCase();
    });
}

// bullet / caret helpers

function isLiChip(node) {
    return (
        !!node &&
        node.nodeType === 1 &&
        node.classList.contains('chip') &&
        node.classList.contains('bul')
    );
}

function liRaw(level) {
    return level > 1 ? '$(li' + level + ')' : '$(li)';
}

function liLevel(chip) {
    const match = /^\$\(li(\d*)\)$/.exec(chip.dataset.raw || '');
    return match ? parseInt(match[1] || '1', 10) : 1;
}

function makeLiChip(level, raw) {
    return makeChip(
        raw || liRaw(level),
        '\u00a0\u00a0'.repeat(Math.max(0, level - 1)) + '\u2022 ',
        'bul'
    );
}
// put the caret right after a node, inside a text node (so typing lands outside any wrapper / chip)

function caretAfter(node) {
    let nextNode = node.nextSibling;
    if (!nextNode || nextNode.nodeType !== 3) {
        nextNode = document.createTextNode(CARET_MARKER);
        node.parentNode.insertBefore(nextNode, node.nextSibling);
        setCaret(nextNode, 1);
    } else {
        setCaret(nextNode, nextNode.data.charAt(0) === CARET_MARKER ? 1 : 0);
    }
}
// describes the logical line (newline / <br> / bullet chip delimited) the caret is on

function lineInfo(host) {
    const selection = window.getSelection();
    if (!selection.rangeCount) {
        return null;
    }
    const range = selection.getRangeAt(0);
    const caretContainer = range.startContainer;
    const caretOffset = range.startOffset;
    const tokens = [];
    let caretTokenIndex = -1;
    const walk = el => {
        const kids = el.childNodes;
        for (let i = 0; i <= kids.length; i++) {
            if (el === caretContainer && i === caretOffset) {
                caretTokenIndex = tokens.length;
                tokens.push({ t: 'm' });
            }
            const c = kids[i];
            if (!c) {
                break;
            }
            if (c.nodeType === 3) {
                if (c === caretContainer) {
                    tokens.push({ t: 'x', n: c, from: 0, to: caretOffset });
                    caretTokenIndex = tokens.length;
                    tokens.push({ t: 'm' });
                    tokens.push({ t: 'x', n: c, from: caretOffset, to: c.data.length });
                } else {
                    tokens.push({ t: 'x', n: c, from: 0, to: c.data.length });
                }
            } else if (c.nodeType === 1) {
                if (c.classList.contains('chip')) {
                    tokens.push({ t: isLiChip(c) ? 'li' : 'c', n: c });
                } else if (c.nodeName === 'BR') {
                    tokens.push({ t: 'br', n: c });
                } else {
                    walk(c);
                }
            }
        }
    };
    walk(host);
    if (caretTokenIndex < 0) {
        return null;
    }
    const info = { chip: null, before: '', after: false, nl: null };
    for (let i = caretTokenIndex - 1; i >= 0; i--) {
        const k = tokens[i];
        if (k.t === 'br') {
            info.nl = { node: k.n, br: true };
            break;
        }
        if (k.t === 'li') {
            info.chip = k.n;
            break;
        }
        if (k.t === 'c') {
            info.before = '\u0001' + info.before;
            continue;
        }
        const s = k.n.data.slice(k.from, k.to);
        const nl = s.lastIndexOf('\n');
        if (nl >= 0) {
            info.before = stripZw(s.slice(nl + 1)) + info.before;
            info.nl = { node: k.n, br: false, off: k.from + nl + 1 };
            break;
        }
        info.before = stripZw(s) + info.before;
    }
    for (let i = caretTokenIndex + 1; i < tokens.length; i++) {
        const k = tokens[i];
        if (k.t === 'br' || k.t === 'li') {
            break;
        }
        if (k.t === 'c') {
            info.after = true;
            break;
        }
        const s = k.n.data.slice(k.from, k.to);
        const nl = s.indexOf('\n');
        if (nl >= 0) {
            if (stripZw(s.slice(0, nl))) {
                info.after = true;
            }
            break;
        }
        if (stripZw(s)) {
            info.after = true;
            break;
        }
    }
    return info;
}

function removeNewlineBefore(info) {
    if (!info.nl) {
        return;
    }
    if (info.nl.br) {
        info.nl.node.remove();
    } else {
        info.nl.node.deleteData(info.nl.off - 1, 1);
    }
}

function replaceChipWith(chip, text) {
    const parent = chip.parentNode;
    const caretMarker = document.createTextNode(CARET_MARKER);
    if (text) {
        parent.insertBefore(document.createTextNode(text), chip);
    }
    parent.insertBefore(caretMarker, chip);
    chip.remove();
    setCaret(caretMarker, 1);
}

function chipNeedsNewline(chip) {
    const previousNode = chip.previousSibling;
    if (!previousNode) {
        return false;
    }
    if (previousNode.nodeType === 3) {
        const d = stripZw(previousNode.data);
        return d === '' ? chipNeedsNewline(previousNode) : !d.endsWith('\n');
    }
    return previousNode.nodeName !== 'BR';
}

function insertBulletAtCaret(host, level, raw) {
    const range = window.getSelection().getRangeAt(0);
    range.deleteContents();
    const chip = makeLiChip(level, raw);
    range.insertNode(chip);
    caretAfter(chip);
}

function toggleBullet(host) {
    const info = lineInfo(host);
    if (!info) {
        return;
    }
    if (info.chip) {
        replaceChipWith(info.chip, chipNeedsNewline(info.chip) ? '\n' : '');
        return;
    }
    const caret = window.getSelection().getRangeAt(0).cloneRange();
    const range = document.createRange();
    if (!info.nl) {
        range.setStart(host, 0);
    } else if (info.nl.br) {
        range.setStartAfter(info.nl.node);
    } else {
        range.setStart(info.nl.node, info.nl.off);
    }
    range.collapse(true);
    setRange(range);
    range.insertNode(makeLiChip(1));
    removeNewlineBefore(info);
    setRange(caret);
}
// splits every ancestor in two so the caret can escape the formatting

function breakOut(host) {
    const selection = window.getSelection();
    if (!selection.rangeCount || !selection.isCollapsed) {
        return;
    }
    const range = selection.getRangeAt(0);
    let node = range.startContainer;
    let offset = range.startOffset;
    if (!host.contains(node)) {
        return;
    }
    if (node.nodeType === 1) {
        const tn = document.createTextNode('');
        node.insertBefore(tn, node.childNodes[offset] || null);
        node = tn;
        offset = 0;
    }
    node.splitText(offset);
    let currentNode = node;
    while (currentNode.parentElement && currentNode.parentElement !== host) {
        const parent = currentNode.parentElement;
        const clone = parent.cloneNode(false);
        while (currentNode.nextSibling) {
            clone.appendChild(currentNode.nextSibling);
        }
        parent.parentElement.insertBefore(clone, parent.nextSibling);
        currentNode = parent;
    }
    const caretMarker = document.createTextNode(CARET_MARKER);
    currentNode.parentElement.insertBefore(caretMarker, currentNode.nextSibling);
    pruneEmpty(host);
    setCaret(caretMarker, 1);
}

function clearFormat() {
    const host = richHost();
    if (!host) {
        return;
    }
    host.focus();
    const selection = window.getSelection();
    if (!selection.rangeCount) {
        return;
    }
    if (selection.isCollapsed) {
        breakOut(host);
        fireInput(host);
        barRefresh();
        return;
    }
    restyle(null, f => {
        Object.assign(f, plainFmt());
    });
}

function handleRichKey(event, host) {
    const selection = window.getSelection();
    const modifierPressed = event.ctrlKey || event.metaKey;
    if (modifierPressed && event.key === ' ') {
        event.preventDefault();
        breakOut(host);
        return true;
    }
    if (modifierPressed && !event.shiftKey && !event.altKey) {
        const k = event.key.toLowerCase();
        if (['b', 'i', 'u'].includes(k)) {
            event.preventDefault();
            toggleFlag(k);
            return true;
        }
    }
    if (event.altKey || (modifierPressed && event.key !== 'Enter')) {
        return false;
    }
    if (event.key === 'Enter') {
        event.preventDefault();
        if (!selection.isCollapsed) {
            document.execCommand('delete');
        }
        const info = lineInfo(host);
        if (info && info.chip) {
            if (!info.before && !info.after) {
                replaceChipWith(info.chip, chipNeedsNewline(info.chip) ? '\n' : '');
                breakOut(host);
            } else {
                const lv = liLevel(info.chip);
                insertBulletAtCaret(host, lv, liRaw(lv));
            }
        } else {
            breakOut(host);
            insertNewline();
        }
        return true;
    }
    if (event.key === 'Backspace' && selection.isCollapsed) {
        const info = lineInfo(host);
        if (info && info.chip && !info.before) {
            event.preventDefault();
            replaceChipWith(info.chip, info.after && chipNeedsNewline(info.chip) ? '\n' : '');
            return true;
        }
        if (deleteBackward(host)) {
            event.preventDefault();
            return true;
        }
        return false;
    }
    if (event.key === 'Tab') {
        const info = lineInfo(host);
        if (!info || !info.chip) {
            return false;
        }
        event.preventDefault();
        const lv = liLevel(info.chip);
        const nl = Math.min(4, Math.max(1, lv + (event.shiftKey ? -1 : 1)));
        if (nl === lv) {
            return false;
        }
        info.chip.replaceWith(makeLiChip(nl, liRaw(nl)));
        return true;
    }
    if (event.key === ' ' && selection.isCollapsed) {
        // "- " or "* " at line start becomes a bullet
        const info = lineInfo(host);
        if (info && !info.chip && (info.before === '-' || info.before === '*')) {
            event.preventDefault();
            document.execCommand('delete');
            const i2 = lineInfo(host);
            if (i2) {
                removeNewlineBefore(i2);
                insertBulletAtCaret(host, 1, '$(li)');
            }
            return true;
        }
    }
    return false;
}

function startEdit(host, readValue, writeValue, options) {
    if (editing) {
        return;
    }
    const single = !!(options && options.single);
    const session = { host: host, rich: !single };
    const bar = $('formatbar');
    editing = session;
    host.classList.remove('empty');
    host.classList.add('editing');
    if (single) {
        host.textContent = readValue() || '';
        host.setAttribute('contenteditable', 'plaintext-only');
    } else {
        renderMarkup(host, (readValue() || '').replace(TRAIL_BR_RE, ''), true);
        host.setAttribute('contenteditable', 'true');
        document.execCommand('styleWithCSS', false, true);
    }
    bar.classList.toggle('active', !single);
    host.addEventListener('input', () => {
        if (editing !== session) {
            return;
        }
        writeValue(single ? host.textContent.replace(/\n/g, '') : serializeRich(host));
    });
    host.addEventListener('keydown', ev => {
        if (editing !== session) {
            return;
        }
        if (ev.key === 'Escape') {
            host.blur();
            return;
        }
        if (single) {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                host.blur();
            }
            return;
        }
        if (handleRichKey(ev, host)) {
            fireInput(host);
            barRefresh();
        }
    });
    host.addEventListener('paste', ev => {
        if (editing !== session) {
            return;
        }
        ev.preventDefault();
        const t = (ev.clipboardData || window.clipboardData)
            .getData('text/plain')
            .replace(/\r\n?/g, '\n');
        insertPlain(single ? t.replace(/\n/g, ' ') : t);
        fireInput(host);
    });
    host.addEventListener('blur', ev => {
        if (ev.relatedTarget && bar.contains(ev.relatedTarget)) {
            return;
        }
        finishEdit(session);
    });
    host.focus();
    const range = document.createRange();
    range.selectNodeContents(host);
    range.collapse(false);
    setRange(range);
}

function finishEdit(session) {
    if (editing !== session) {
        return;
    }
    editing = null;
    hideArgBox();
    $('formatbar').classList.remove('active');
    renderAll();
}

// format bar
let savedRange = null;
let argKind = null;
let barRefresh = () => {};

function exec(command, value) {
    const host = richHost();
    if (!host) {
        return;
    }
    host.focus();
    document.execCommand(command, false, value);
    fireInput(host);
    barRefresh();
}

function insertChip(raw, label, className) {
    const host = richHost();
    if (!host) {
        return;
    }
    host.focus();
    const chip = makeChip(raw, label, className);
    const selection = window.getSelection();
    if (!selection.rangeCount) {
        return;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(chip);
    range.setStartAfter(chip);
    range.collapse(true);
    setRange(range);
    fireInput(host);
}

function wrapSelection(attribute, value, label) {
    const host = richHost();
    if (!host) {
        return;
    }
    host.focus();
    setRange(savedRange);
    const selection = window.getSelection();
    if (!selection.rangeCount) {
        return;
    }
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.dataset[attribute] = value;
    if (attribute === 'link' || attribute === 'cmd') {
        span.style.color = '#' + hex6(gb.linkColor);
        span.style.textDecoration = 'underline';
    }
    if (attribute === 'tip') {
        span.classList.add('tip');
    }
    if (attribute === 'k') {
        span.classList.add('obf');
    }
    if (range.collapsed) {
        span.textContent = label || 'text';
    } else {
        span.appendChild(range.extractContents());
    }
    range.insertNode(span);
    caretAfter(span); // caret lands outside the new span so typing doesn't extend it
    fireInput(host);
}

function showArgBox(kind, placeholder) {
    const selection = window.getSelection();
    savedRange = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    argKind = kind;
    const input = $('argInput');
    const suggestions = $('argSuggestions');
    input.placeholder = placeholder;
    input.value = '';
    suggestions.textContent = '';
    if (kind === 'link') {
        gb.entries.forEach(e => suggestions.appendChild(h('option', null, { value: e.id })));
        gb.categories.forEach(c => suggestions.appendChild(h('option', null, { value: c.id })));
    }
    $('argBox').classList.remove('hidden');
    input.focus();
}

function hideArgBox() {
    argKind = null;
    $('argBox').classList.add('hidden');
}

function applyArg() {
    const value = $('argInput').value.trim();
    const kind = argKind;
    hideArgBox();
    if (!editing) {
        return;
    }
    if (!value) {
        editing.host.focus();
        return;
    }
    if (kind === 'link') {
        wrapSelection('link', value, value);
    } else if (kind === 'tip') {
        wrapSelection('tip', value, 'text');
    } else if (kind === 'cmd') {
        wrapSelection('cmd', value.charAt(0) === '/' ? value : '/' + value, 'command');
    } else if (kind === 'key') {
        editing.host.focus();
        restoreRange();
        insertChip('$(k:' + value + ')', '[' + value + ']');
    }
}

function restoreRange() {
    setRange(savedRange);
}

function buildFormatBar() {
    const formatBar = $('formatbar');
    const appendControl = el => formatBar.insertBefore(el, $('argBox'));
    formatBar.addEventListener('mousedown', ev => {
        if (ev.target.tagName !== 'INPUT') {
            ev.preventDefault();
        }
    });
    const addButton = (label, title, fn, cls) => {
        const b = h('button', 'fb' + (cls ? ' ' + cls : ''), { text: label, title: title });
        b.addEventListener('mousedown', ev => {
            ev.preventDefault();
            fn();
        });
        appendControl(b);
        return b;
    };
    const addSeparator = () => appendControl(h('span', 'split'));
    const tracked = [
        [addButton('B', 'Bold (Ctrl+B)', () => toggleFlag('b'), 'b'), 'b'],
        [addButton('I', 'Italic (Ctrl+I)', () => toggleFlag('i'), 'i'), 'i'],
        [addButton('U', 'Underline (Ctrl+U)', () => toggleFlag('u'), 'u'), 'u'],
        [addButton('S', 'Strikethrough', () => toggleFlag('s'), 's'), 's'],
        [addButton('?', 'Obfuscated', () => toggleFlag('k')), 'k']
    ];
    barRefresh = () => {
        const host = richHost();
        if (host) {
            tracked.forEach(([b, k]) => b.classList.toggle('on', flagState(host, k)));
        }
    };
    document.addEventListener('selectionchange', barRefresh);
    addSeparator();
    COLORS16.concat(['BB00BB', '449900']).forEach((c, i) => {
        const s = h('button', 'swatch', {
            title: i < 16 ? 'Color' : i === 16 ? 'Item color' : 'Thing color',
            style: 'background:#' + c
        });
        s.addEventListener('mousedown', ev => {
            ev.preventDefault();
            setColor(c);
        });
        appendControl(s);
    });
    addSeparator();
    addButton('Link', '', () =>
        showArgBox('link', window.javabridge.t('elementgui.guidebook.link_hint'))
    );
    addButton('Tip', '', () => showArgBox('tip', 'tooltip text'));
    addButton('Cmd', '', () => showArgBox('cmd', '/command'));
    addSeparator();
    addButton(
        'Clear',
        '',
        clearFormat
    );
    addButton(
        '\u2022 List',
        '',
        () => {
            const host = richHost();
            if (!host) {
                return;
            }
            host.focus();
            toggleBullet(host);
            fireInput(host);
        }
    );
    addButton('Player', 'Player name', () => insertChip('$(playername)', 'Player'));
    addButton('Key', 'Keybind', () => showArgBox('key', window.javabridge.t('elementgui.guidebook.keybind_hint')));
    $('argOk').addEventListener('mousedown', ev => {
        ev.preventDefault();
        applyArg();
    });
    $('argInput').addEventListener('keydown', ev => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            applyArg();
        }
        if (ev.key === 'Escape') {
            hideArgBox();
            if (editing) {
                editing.host.focus();
            }
        }
    });
    $('argInput').addEventListener('blur', ev => {
        if (
            ev.relatedTarget &&
            (formatBar.contains(ev.relatedTarget) || (editing && editing.host === ev.relatedTarget))
        ) {
            return;
        }
        if (editing && !$('argBox').classList.contains('hidden')) {
            finishEdit(editing);
        }
    });
}