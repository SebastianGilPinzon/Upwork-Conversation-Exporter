// ==============================================================
// Upwork Chat Exporter v2.0 - Full Conversation + File Downloads
// ==============================================================
//
// FEATURES:
// - Auto-scrolls to load ALL messages (handles lazy loading)
// - Extracts full conversation with sender names & timestamps
// - Downloads all file attachments (images, docs) as a ZIP
// - Excludes videos (mp4, Loom, etc.)
// - Exports conversation as TXT + JSON
// - Detailed console logging for every step and failure
//
// INSTRUCTIONS:
// 1. Open the Upwork conversation in Chrome
// 2. Open DevTools (F12) -> Console tab
// 3. If Chrome blocks pasting, type: allow pasting
// 4. Paste this entire script and press Enter
// 5. Wait for auto-scroll to finish (watch the console log)
// 6. Files will download automatically when done
//
// ==============================================================

(async function () {
  'use strict';

  console.log('%c[UCE] Upwork Chat Exporter v2.0 starting...', 'color:#14a800;font-weight:bold;font-size:14px');
  console.log('[UCE] Timestamp:', new Date().toISOString());
  console.log('[UCE] Page URL:', window.location.href);

  // ============================================================
  // CONFIG
  // ============================================================
  const SCROLL_PAUSE_MS = 1500;
  const SCROLL_TIMEOUT_MS = 8000;
  const MAX_UNCHANGED_CYCLES = 6;
  const FILE_FETCH_DELAY_MS = 500;

  console.log('[UCE] Config:', { SCROLL_PAUSE_MS, SCROLL_TIMEOUT_MS, MAX_UNCHANGED_CYCLES, FILE_FETCH_DELAY_MS });

  // ============================================================
  // UI: Progress overlay
  // ============================================================
  function createProgressUI() {
    const overlay = document.createElement('div');
    overlay.id = 'upwork-exporter-overlay';
    overlay.innerHTML = `
      <div style="position:fixed;bottom:20px;right:20px;z-index:999999;
        background:#1a1a1a;color:#fff;padding:16px 24px;border-radius:12px;
        font-family:system-ui,sans-serif;font-size:14px;min-width:320px;
        box-shadow:0 8px 32px rgba(0,0,0,0.4);border:1px solid #333;">
        <div style="font-weight:600;margin-bottom:8px;" id="uce-title">Upwork Chat Exporter</div>
        <div id="uce-status" style="color:#aaa;">Initializing...</div>
        <div style="margin-top:8px;background:#333;border-radius:4px;height:6px;overflow:hidden;">
          <div id="uce-bar" style="height:100%;background:#14a800;width:0%;transition:width 0.3s;"></div>
        </div>
        <div id="uce-detail" style="color:#666;font-size:12px;margin-top:6px;"></div>
      </div>`;
    document.body.appendChild(overlay);
    console.log('[UCE] Progress UI created');
    return {
      setStatus(text) { document.getElementById('uce-status').textContent = text; },
      setProgress(pct) { document.getElementById('uce-bar').style.width = pct + '%'; },
      setDetail(text) { document.getElementById('uce-detail').textContent = text; },
      remove() { overlay.remove(); }
    };
  }

  const ui = createProgressUI();

  try {
    // ============================================================
    // PHASE 1: Auto-scroll to load ALL messages
    // ============================================================
    console.log('%c[UCE] === PHASE 1: Auto-scroll to load all messages ===', 'color:#14a800;font-weight:bold');
    ui.setStatus('Phase 1/3: Loading all messages...');
    ui.setProgress(5);

    async function scrollToLoadAll() {
      console.log('[UCE][Scroll] Looking for scroll container...');

      const container = document.getElementById('story-viewport')
        || document.querySelector('.scroll-wrapper');

      if (!container) {
        console.error('[UCE][Scroll] FAILED: Could not find #story-viewport or .scroll-wrapper');
        console.error('[UCE][Scroll] Available IDs on page:', Array.from(document.querySelectorAll('[id]')).map(e => e.id).slice(0, 30));
        throw new Error('Could not find scroll container (#story-viewport). Are you on an Upwork chat page?');
      }

      console.log('[UCE][Scroll] Found container:', container.id || container.className);
      console.log('[UCE][Scroll] Container dimensions:', {
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight,
        scrollTop: container.scrollTop,
        overflow: getComputedStyle(container).overflowY,
        flexDirection: getComputedStyle(container).flexDirection
      });

      let previousCount = 0;
      let unchangedCycles = 0;
      let totalLoaded = document.querySelectorAll('.up-d-story-item').length;
      let scrollCycle = 0;

      console.log(`[UCE][Scroll] Initial message count: ${totalLoaded}`);

      while (unchangedCycles < MAX_UNCHANGED_CYCLES) {
        scrollCycle++;
        totalLoaded = document.querySelectorAll('.up-d-story-item').length;
        ui.setDetail(`${totalLoaded} messages loaded... (cycle ${scrollCycle})`);

        if (totalLoaded === previousCount) {
          unchangedCycles++;
          console.log(`[UCE][Scroll] Cycle ${scrollCycle}: No new messages (unchanged ${unchangedCycles}/${MAX_UNCHANGED_CYCLES}), count=${totalLoaded}`);
        } else {
          const newMsgs = totalLoaded - previousCount;
          console.log(`[UCE][Scroll] Cycle ${scrollCycle}: +${newMsgs} new messages, total=${totalLoaded}`);
          unchangedCycles = 0;
          previousCount = totalLoaded;
        }

        // column-reverse: scrollTop=0 is bottom, negative is older messages
        const scrollBefore = container.scrollTop;
        const maxScroll = -(container.scrollHeight - container.clientHeight);
        container.scrollTop = Math.min(container.scrollTop - 2000, maxScroll);
        const scrollAfter = container.scrollTop;
        console.log(`[UCE][Scroll] Cycle ${scrollCycle}: scrollTop ${scrollBefore.toFixed(0)} -> ${scrollAfter.toFixed(0)} (max=${maxScroll.toFixed(0)})`);

        // Wait for new content via MutationObserver + timeout
        const waitResult = await new Promise((resolve) => {
          let resolved = false;
          const startWait = Date.now();
          const done = (reason) => {
            if (!resolved) {
              resolved = true;
              observer.disconnect();
              clearTimeout(timer);
              resolve({ reason, waitMs: Date.now() - startWait });
            }
          };

          const observer = new MutationObserver(() => {
            const newCount = document.querySelectorAll('.up-d-story-item').length;
            if (newCount > totalLoaded) {
              setTimeout(() => done('mutation'), 300);
            }
          });
          observer.observe(container, { childList: true, subtree: true });

          const timer = setTimeout(() => done('timeout'), SCROLL_TIMEOUT_MS);
        });

        console.log(`[UCE][Scroll] Cycle ${scrollCycle}: Wait resolved by ${waitResult.reason} after ${waitResult.waitMs}ms`);

        await new Promise(r => setTimeout(r, SCROLL_PAUSE_MS));
      }

      const finalCount = document.querySelectorAll('.up-d-story-item').length;
      console.log(`%c[UCE][Scroll] COMPLETE: ${finalCount} total messages loaded in ${scrollCycle} cycles`, 'color:#14a800;font-weight:bold');
      return finalCount;
    }

    await scrollToLoadAll();
    ui.setProgress(33);

    // ============================================================
    // PHASE 2: Extract messages
    // ============================================================
    console.log('%c[UCE] === PHASE 2: Extracting messages and attachments ===', 'color:#14a800;font-weight:bold');
    ui.setStatus('Phase 2/3: Extracting messages...');

    function getVueData(el) {
      if (el.__vue__) return el.__vue__;
      if (el.__vue_app__) return el.__vue_app__;
      return null;
    }

    function extractMessageText(el) {
      const processNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent;
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const tag = node.tagName.toLowerCase();
        if (node.classList?.contains('end-of-message')) return '';
        if (tag === 'br') return '\n';
        if (tag === 'p') return Array.from(node.childNodes).map(processNode).join('') + '\n';
        if (tag === 'a') {
          const href = node.getAttribute('href') || '';
          const text = node.textContent || '';
          return href && href !== text ? `${text} (${href})` : text;
        }
        if (tag === 'pre' || tag === 'code') return '`' + node.textContent + '`';
        if (tag === 'strong' || tag === 'b') return '**' + node.textContent + '**';
        if (tag === 'em' || tag === 'i') return '_' + node.textContent + '_';
        if (tag === 'img') return `[Image: ${node.alt || node.src || ''}]`;
        if (tag === 'ul' || tag === 'ol') {
          return Array.from(node.children).map((li, i) => {
            const prefix = tag === 'ol' ? `${i + 1}. ` : '- ';
            return prefix + li.textContent.trim();
          }).join('\n') + '\n';
        }
        return Array.from(node.childNodes).map(processNode).join('');
      };
      return processNode(el).trim();
    }

    // --- Clean UI noise from system messages ---
    const normalizeUrl = url => (url || '').replace(/^https?:\/\/[^/]+/, '');

    function cleanSystemMessage(text) {
      if (!text) return '';

      // Remove common Upwork UI artifacts
      const NOISE_PATTERNS = [
        /\s*Favorite message\s*/gi,
        /\s*More options\s*/gi,
        /\s*Editing is only available for \d+ hours?\.?\s*/gi,
        /\s*View contract\s*/gi,
        /\s*View details\s*/gi,
        /\s*Reply\s*$/gi,
      ];

      for (const pattern of NOISE_PATTERNS) {
        text = text.replace(pattern, ' ');
      }

      // Remove standalone avatar initials ONLY if they are the entire line content
      // (e.g. "SG" rendered from avatar circle, not real words like "OK" or "US")
      text = text.replace(/^\s*[A-Z]{1,3}\s*$/gm, '');

      // Clean up excessive whitespace from removed noise
      text = text.replace(/\n\s*\n\s*\n/g, '\n');
      text = text.replace(/\s{3,}/g, ' ');
      text = text.trim();

      // Format limit changes nicely: "Old limit: 15 hrs/weekNew limit: 20 hrs/week"
      text = text.replace(/Old limit:\s*(\d+ hrs\/week)\s*New limit:\s*(\d+ hrs\/week)/gi,
        'Old limit: $1 | New limit: $2');
      text = text.replace(/Limit (increases|decreases) take effect (immediately|on Monday)/gi,
        '($&)');

      // Final cleanup
      text = text.replace(/\s+/g, ' ').trim();

      // If after cleaning there's basically nothing left, return empty
      if (text.length < 3) return '';

      return text;
    }

    function extractFromDOM() {
      const chatTitle = document.querySelector('[data-test="room-title"]')?.textContent?.trim() || 'Upwork Chat';
      const chatSubtitle = document.querySelector('[data-test="room-subtitle"]')?.textContent?.trim() || '';
      console.log(`[UCE][Extract] Chat title: "${chatTitle}"`);
      console.log(`[UCE][Extract] Chat subtitle: "${chatSubtitle}"`);

      const messages = [];
      const attachments = [];

      const storyItems = document.querySelectorAll('.up-d-story-item');
      console.log(`[UCE][Extract] Found ${storyItems.length} story items in DOM`);

      if (storyItems.length === 0) {
        console.error('[UCE][Extract] FAILED: No .up-d-story-item elements found');
        console.log('[UCE][Extract] DOM debug - body children:', document.body.children.length);
        console.log('[UCE][Extract] DOM debug - #__nuxt exists:', !!document.getElementById('__nuxt'));
        console.log('[UCE][Extract] DOM debug - .up-d-room exists:', !!document.querySelector('.up-d-room'));
        return null;
      }

      let currentSender = '';
      let currentDate = '';
      let senderDetectionStats = { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, failed: 0 };
      let msgCount = 0;
      let sysCount = 0;
      let skippedCount = 0;

      storyItems.forEach((item, itemIndex) => {
        // Date header
        const dateHeader = item.querySelector('.story-day-header');
        if (dateHeader) {
          const dateText = dateHeader.textContent?.trim();
          if (dateText) {
            currentDate = dateText;
            console.log(`[UCE][Extract] Date header found: "${dateText}"`);
          }
        }

        const story = item.querySelector('[data-test="story-container"], .up-d-story');
        if (!story) {
          skippedCount++;
          return;
        }

        const storyInner = item.querySelector('.story-inner');
        const isNewSender = storyInner?.classList.contains('top');

        // --- Sender name detection (6 strategies) ---
        if (isNewSender) {
          let sender = '';
          let strategy = '';

          // S1: Avatar img alt
          const avatarImg = item.querySelector('.up-d-avatar img');
          if (avatarImg?.alt) { sender = avatarImg.alt; strategy = 'S1:avatar-alt'; senderDetectionStats.s1++; }

          // S2: Avatar title
          if (!sender) {
            const avatar = item.querySelector('.up-d-avatar');
            if (avatar?.title) { sender = avatar.title; strategy = 'S2:avatar-title'; senderDetectionStats.s2++; }
          }

          // S3: aria-label
          if (!sender) {
            const ariaEl = item.querySelector('[aria-label*="avatar"], [aria-label*="photo"]');
            if (ariaEl) { sender = ariaEl.getAttribute('aria-label').replace(/'s (avatar|photo)/i, ''); strategy = 'S3:aria-label'; senderDetectionStats.s3++; }
          }

          // S4: Name element
          if (!sender) {
            for (const sel of ['.story-sender-name', '.sender-name', '.user-name', '.username', '[class*="sender-name"]', '[class*="user-name"]', '.air3-truncation']) {
              const el = item.querySelector(sel);
              if (el?.textContent?.trim()) { sender = el.textContent.trim(); strategy = `S4:${sel}`; senderDetectionStats.s4++; break; }
            }
          }

          // S5: Vue component data
          if (!sender) {
            try {
              const vue = getVueData(item) || getVueData(story);
              if (vue) {
                sender = vue.story?.user?.name || vue.story?.author?.name
                  || vue.$props?.story?.user?.name || vue.message?.sender?.name || '';
                if (sender) { strategy = 'S5:vue-data'; senderDetectionStats.s5++; }
              }
            } catch (e) {
              console.warn(`[UCE][Extract] S5 Vue error at item ${itemIndex}:`, e.message);
            }
          }

          // S6: Text walker
          if (!sender) {
            const section = item.querySelector('.story-section');
            if (section) {
              const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
              let node;
              while (node = walker.nextNode()) {
                const text = node.textContent.trim();
                if (text && text.length < 40 && !node.parentElement.closest('.story-message, [data-test="story-message"]')) {
                  sender = text; strategy = 'S6:text-walker'; senderDetectionStats.s6++; break;
                }
              }
            }
          }

          if (sender) {
            if (sender !== currentSender) {
              console.log(`[UCE][Extract] Sender detected: "${sender}" via ${strategy} (item #${itemIndex})`);
            }
            currentSender = sender;
          } else {
            senderDetectionStats.failed++;
            console.warn(`[UCE][Extract] FAILED to detect sender at item #${itemIndex}, keeping previous: "${currentSender}"`);
            console.warn('[UCE][Extract]   Item classes:', item.className);
            console.warn('[UCE][Extract]   Inner HTML preview:', item.innerHTML.substring(0, 200));
          }
        }

        // --- Timestamp ---
        let timestamp = '';
        const timeEl = item.querySelector('time');
        if (timeEl) timestamp = timeEl.getAttribute('datetime') || timeEl.textContent?.trim() || '';
        if (!timestamp) {
          const tsEl = item.querySelector('[class*="timestamp"], [class*="time"]:not(time), .story-time');
          if (tsEl) timestamp = tsEl.textContent?.trim() || '';
        }

        // --- File attachments ---
        const fileRefs = item.querySelectorAll('.up-d-story-reference, .attachment-item');
        fileRefs.forEach((ref, refIndex) => {
          if (ref.closest('.deleted')) {
            console.log(`[UCE][Extract] Skipping deleted attachment at item #${itemIndex}`);
            return;
          }

          let fileName = '';
          let downloadUrl = '';
          let mimeType = '';
          let fileSize = '';
          let source = 'none';

          // Try Vue data first
          try {
            const vue = getVueData(ref);
            if (vue?.file || vue?.$props?.file) {
              const f = vue.file || vue.$props.file;
              fileName = f.fileName || f.metadata?.fileName || '';
              downloadUrl = f.objectUrl || f.metadata?.objectUrl || f.url || f.metadata?.url || '';
              mimeType = f.metadata?.mimeType || '';
              fileSize = f.fileSize || f.metadata?.fileSize || '';
              source = 'vue';
              console.log(`[UCE][Extract] Attachment via Vue: "${fileName}" (${mimeType}) url=${downloadUrl ? 'yes' : 'NO'}`);
            }
          } catch (e) {
            console.warn(`[UCE][Extract] Vue attachment error at item #${itemIndex} ref #${refIndex}:`, e.message);
          }

          // Fallback: DOM extraction
          if (!downloadUrl) {
            const imgLink = ref.querySelector('.up-d-story-img, .story-file-preview');
            if (imgLink) {
              downloadUrl = imgLink.getAttribute('href') || imgLink.querySelector('img')?.src || '';
              fileName = fileName || imgLink.querySelector('img')?.alt || '';
              source = 'dom-img';
            }
            const docLink = ref.querySelector('.story-file-description a, .attachment a, a[href*="/messages/att"], a[href*="/messages/files"]');
            if (!downloadUrl && docLink) {
              downloadUrl = docLink.href || '';
              source = 'dom-doc';
            }
            if (!fileName) {
              const nameEl = ref.querySelector('.file-name .name, .file-name a, .file-name');
              fileName = nameEl?.textContent?.trim() || '';
            }
            if (!fileSize) {
              const sizeEl = ref.querySelector('.file-content, .file-size');
              fileSize = sizeEl?.textContent?.trim() || '';
            }
            if (downloadUrl) {
              console.log(`[UCE][Extract] Attachment via DOM(${source}): "${fileName}" url=${downloadUrl.substring(0, 80)}...`);
            }
          }

          if (!fileName && !downloadUrl) {
            console.warn(`[UCE][Extract] Attachment with no name and no URL at item #${itemIndex}, ref classes: ${ref.className}`);
            console.warn('[UCE][Extract]   Ref innerHTML preview:', ref.innerHTML.substring(0, 300));
          }

          if (fileName || downloadUrl) {
            if (downloadUrl && attachments.some(a => normalizeUrl(a.downloadUrl) === normalizeUrl(downloadUrl))) {
              console.log(`[UCE][Extract] Skipping duplicate attachment: "${fileName}" (${source}) - URL already collected`);
            } else {
              attachments.push({ fileName, downloadUrl, mimeType, fileSize, sender: currentSender, date: currentDate, source });
            }
          }
        });

        // Also check for standalone image thumbnails
        const thumbnails = item.querySelectorAll('.story-thumbnail img, .up-d-story-img img');
        thumbnails.forEach(img => {
          const src = img.src || img.dataset?.src || '';
          const alt = img.alt || '';
          const parentLink = img.closest('a');
          const fullUrl = parentLink?.href || src;
          if (src && !attachments.some(a => normalizeUrl(a.downloadUrl) === normalizeUrl(fullUrl))) {
            console.log(`[UCE][Extract] Standalone thumbnail found: "${alt || 'image'}" at item #${itemIndex}`);
            attachments.push({ fileName: alt || 'image.png', downloadUrl: fullUrl, mimeType: 'image/*', fileSize: '', sender: currentSender, date: currentDate, source: 'thumbnail' });
          } else if (src) {
            console.log(`[UCE][Extract] Skipping duplicate thumbnail: "${alt || 'image'}" at item #${itemIndex} - URL already collected`);
          }
        });

        // --- Message content ---
        const messageEl = item.querySelector('[data-test="story-message"]');
        if (messageEl) {
          const text = extractMessageText(messageEl);
          if (text) {
            messages.push({ sender: currentSender, date: currentDate, time: timestamp, text, isNewSender });
            msgCount++;
          } else {
            console.warn(`[UCE][Extract] Empty message text at item #${itemIndex}, sender: ${currentSender}`);
          }
          return;
        }

        // System message
        let storyText = story.textContent?.trim();
        if (storyText && storyText.length < 1000) {
          // Clean UI noise from system messages
          storyText = cleanSystemMessage(storyText);
          if (storyText) {
            messages.push({ sender: '[SYSTEM]', date: currentDate, time: timestamp, text: storyText, isNewSender: true, isSystem: true });
            sysCount++;
          } else {
            console.log(`[UCE][Extract] Filtered out empty system message after cleaning at item #${itemIndex}`);
          }
        } else if (storyText) {
          console.warn(`[UCE][Extract] Skipped oversized system message at item #${itemIndex} (${storyText.length} chars)`);
        }
      });

      console.log(`[UCE][Extract] --- Extraction Summary ---`);
      console.log(`[UCE][Extract] User messages: ${msgCount}`);
      console.log(`[UCE][Extract] System messages: ${sysCount}`);
      console.log(`[UCE][Extract] Skipped items (no story): ${skippedCount}`);
      console.log(`[UCE][Extract] Attachments found: ${attachments.length}`);
      console.log(`[UCE][Extract] Sender detection stats:`, senderDetectionStats);
      console.log(`[UCE][Extract] Attachment sources:`, attachments.reduce((acc, a) => { acc[a.source] = (acc[a.source] || 0) + 1; return acc; }, {}));

      if (attachments.length > 0) {
        console.log('[UCE][Extract] Attachment list:');
        attachments.forEach((a, i) => {
          console.log(`  ${i + 1}. [${a.source}] "${a.fileName}" (${a.mimeType || 'unknown type'}) ${a.fileSize || ''} - URL: ${a.downloadUrl ? a.downloadUrl.substring(0, 60) + '...' : 'MISSING'}`);
        });
      }

      return { chatTitle, chatSubtitle, messages, attachments };
    }

    const data = extractFromDOM();
    if (!data || data.messages.length === 0) {
      console.error('[UCE] FATAL: No messages extracted from DOM');
      throw new Error('Could not find any messages. Are you on an Upwork chat page?');
    }

    console.log(`%c[UCE] Extracted ${data.messages.length} messages, ${data.attachments.length} file attachments`, 'color:#14a800;font-weight:bold');
    ui.setDetail(`${data.messages.length} messages, ${data.attachments.length} files found`);
    ui.setProgress(50);

    // ============================================================
    // PHASE 3: Filter attachments & download
    // ============================================================
    console.log('%c[UCE] === PHASE 3: Filter and download files ===', 'color:#14a800;font-weight:bold');
    ui.setStatus('Phase 3/3: Downloading files...');

    // --- Filter out videos ---
    const VIDEO_EXT = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.flv', '.wmv', '.m4v'];
    const LOOM_RE = /loom\.com\/(share|embed)/i;

    const excludedFiles = [];
    let downloadableFiles = data.attachments.filter(att => {
      const name = (att.fileName || '').toLowerCase();
      const mime = (att.mimeType || '').toLowerCase();
      const url = (att.downloadUrl || '').toLowerCase();

      if (VIDEO_EXT.some(ext => name.endsWith(ext))) { excludedFiles.push({ ...att, reason: 'video extension' }); return false; }
      if (mime.startsWith('video/')) { excludedFiles.push({ ...att, reason: 'video mime type' }); return false; }
      if (LOOM_RE.test(url) || LOOM_RE.test(att.downloadUrl)) { excludedFiles.push({ ...att, reason: 'loom link' }); return false; }
      if (!att.downloadUrl) { excludedFiles.push({ ...att, reason: 'no download URL' }); return false; }

      return true;
    });

    // --- Deduplicate by URL (safety net for any remaining duplicates) ---
    const seenUrls = new Set();
    const preDedupCount = downloadableFiles.length;
    downloadableFiles = downloadableFiles.filter(att => {
      const urlPath = normalizeUrl(att.downloadUrl);
      if (seenUrls.has(urlPath)) {
        console.log(`[UCE][Filter] Dedup: skipping duplicate "${att.fileName}" (source: ${att.source})`);
        return false;
      }
      seenUrls.add(urlPath);
      return true;
    });

    console.log(`[UCE][Filter] Downloadable files: ${downloadableFiles.length} (deduped from ${preDedupCount})`);
    console.log(`[UCE][Filter] Excluded files: ${excludedFiles.length}`);
    if (excludedFiles.length > 0) {
      console.log('[UCE][Filter] Excluded file details:');
      excludedFiles.forEach((f, i) => {
        console.log(`  ${i + 1}. "${f.fileName}" - reason: ${f.reason}`);
      });
    }

    // --- Format text output ---
    function formatTxt(data) {
      const lines = [];
      lines.push('='.repeat(60));
      lines.push(`UPWORK CONVERSATION: ${data.chatTitle}`);
      if (data.chatSubtitle) lines.push(data.chatSubtitle);
      lines.push(`Exported: ${new Date().toLocaleString()}`);
      lines.push(`Total messages: ${data.messages.length}`);
      lines.push(`File attachments: ${downloadableFiles.length}`);
      lines.push('='.repeat(60));

      let lastDate = '';
      for (const msg of data.messages) {
        if (msg.date && msg.date !== lastDate) {
          lines.push('');
          lines.push(`--- ${msg.date} ---`);
          lines.push('');
          lastDate = msg.date;
        }
        if (msg.isNewSender) {
          lines.push(msg.time ? `[${msg.sender}] (${msg.time})` : `[${msg.sender}]`);
        }
        lines.push(msg.text);
        if (msg.isNewSender) lines.push('');
      }

      if (downloadableFiles.length > 0) {
        lines.push('');
        lines.push('='.repeat(60));
        lines.push('ATTACHED FILES');
        lines.push('='.repeat(60));
        downloadableFiles.forEach((f, i) => {
          lines.push(`${i + 1}. ${f.fileName} ${f.fileSize ? '(' + f.fileSize + ')' : ''} - from ${f.sender} on ${f.date}`);
        });
      }

      return lines.join('\n');
    }

    const txtOutput = formatTxt(data);
    const jsonOutput = JSON.stringify({ ...data, downloadableFiles, excludedFiles }, null, 2);
    const safeName = data.chatTitle.replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);

    console.log(`[UCE][Output] TXT length: ${txtOutput.length} chars`);
    console.log(`[UCE][Output] JSON length: ${jsonOutput.length} chars`);
    console.log(`[UCE][Output] Safe filename: ${safeName}`);

    // --- Download files as ZIP using JSZip ---
    if (downloadableFiles.length > 0) {
      console.log('[UCE][ZIP] Loading JSZip library...');
      ui.setDetail('Loading JSZip library...');

      if (!window.JSZip) {
        try {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => { console.log('[UCE][ZIP] JSZip loaded successfully'); resolve(); };
            script.onerror = (e) => { console.error('[UCE][ZIP] FAILED to load JSZip:', e); reject(new Error('Failed to load JSZip from CDN')); };
            document.head.appendChild(script);
          });
        } catch (e) {
          console.error('[UCE][ZIP] JSZip load error:', e);
          throw new Error('Failed to load JSZip library. Cannot create ZIP file. Check your internet connection.');
        }
      } else {
        console.log('[UCE][ZIP] JSZip already available');
      }

      const zip = new JSZip();
      const usedNames = new Set();
      let downloaded = 0;
      let failed = 0;
      const failedFiles = [];

      zip.file(`conversation-${dateStr}.txt`, txtOutput);
      zip.file(`conversation-${dateStr}.json`, jsonOutput);
      console.log('[UCE][ZIP] Added conversation TXT and JSON to ZIP');

      const filesFolder = zip.folder('files');

      for (let i = 0; i < downloadableFiles.length; i++) {
        const att = downloadableFiles[i];
        const progressPct = 50 + Math.round((i / downloadableFiles.length) * 40);
        ui.setDetail(`Downloading file ${i + 1}/${downloadableFiles.length}: ${att.fileName}`);
        ui.setProgress(progressPct);

        console.log(`[UCE][Download] ${i + 1}/${downloadableFiles.length}: "${att.fileName}" from ${att.downloadUrl.substring(0, 80)}...`);

        try {
          const fetchStart = Date.now();
          const response = await fetch(att.downloadUrl, { credentials: 'include' });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
          }

          console.log(`[UCE][Download]   Response: ${response.status} ${response.statusText}, Content-Type: ${response.headers.get('content-type')}, Content-Length: ${response.headers.get('content-length')}`);

          const blob = await response.blob();
          const fetchMs = Date.now() - fetchStart;

          // Handle duplicate names
          let name = att.fileName || `file-${i}`;
          if (usedNames.has(name)) {
            const ext = name.lastIndexOf('.') > 0 ? name.slice(name.lastIndexOf('.')) : '';
            const base = name.slice(0, name.length - ext.length);
            let counter = 2;
            while (usedNames.has(`${base}_${counter}${ext}`)) counter++;
            const oldName = name;
            name = `${base}_${counter}${ext}`;
            console.log(`[UCE][Download]   Renamed duplicate: "${oldName}" -> "${name}"`);
          }
          usedNames.add(name);

          filesFolder.file(name, blob);
          downloaded++;
          console.log(`[UCE][Download]   OK: "${name}" (${(blob.size / 1024).toFixed(1)} KB, ${fetchMs}ms)`);
        } catch (err) {
          failed++;
          failedFiles.push({ fileName: att.fileName, url: att.downloadUrl, error: err.message });
          console.error(`[UCE][Download]   FAILED: "${att.fileName}" - ${err.message}`);
          console.error(`[UCE][Download]   URL was: ${att.downloadUrl}`);
        }

        await new Promise(r => setTimeout(r, FILE_FETCH_DELAY_MS));
      }

      console.log(`[UCE][Download] --- Download Summary ---`);
      console.log(`[UCE][Download] OK: ${downloaded}/${downloadableFiles.length}`);
      console.log(`[UCE][Download] Failed: ${failed}/${downloadableFiles.length}`);

      if (failedFiles.length > 0) {
        console.warn('[UCE][Download] Failed files:');
        failedFiles.forEach((f, i) => {
          console.warn(`  ${i + 1}. "${f.fileName}" - ${f.error}`);
          console.warn(`     URL: ${f.url}`);
        });
      }

      console.log('[UCE][ZIP] Generating ZIP file...');
      ui.setDetail('Generating ZIP file...');
      ui.setProgress(92);

      try {
        const zipStart = Date.now();
        const zipBlob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
        const zipMs = Date.now() - zipStart;

        console.log(`[UCE][ZIP] ZIP generated: ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB in ${zipMs}ms`);

        const zipUrl = URL.createObjectURL(zipBlob);
        const zipLink = document.createElement('a');
        zipLink.href = zipUrl;
        zipLink.download = `upwork-export-${safeName}-${dateStr}.zip`;
        document.body.appendChild(zipLink);
        zipLink.click();
        document.body.removeChild(zipLink);
        URL.revokeObjectURL(zipUrl);

        console.log(`[UCE][ZIP] ZIP download triggered: upwork-export-${safeName}-${dateStr}.zip`);
      } catch (zipErr) {
        console.error('[UCE][ZIP] FAILED to generate ZIP:', zipErr);
        console.log('[UCE][ZIP] Falling back to individual file downloads...');

        // Fallback: download TXT and JSON individually
        const txtBlob = new Blob([txtOutput], { type: 'text/plain;charset=utf-8' });
        const txtUrl = URL.createObjectURL(txtBlob);
        const txtLink = document.createElement('a');
        txtLink.href = txtUrl;
        txtLink.download = `upwork-chat-${safeName}-${dateStr}.txt`;
        document.body.appendChild(txtLink);
        txtLink.click();
        document.body.removeChild(txtLink);
        URL.revokeObjectURL(txtUrl);
        console.log('[UCE][Fallback] TXT downloaded');
      }
    } else {
      console.log('[UCE][Output] No downloadable files, exporting TXT and JSON only');

      const txtBlob = new Blob([txtOutput], { type: 'text/plain;charset=utf-8' });
      const txtUrl = URL.createObjectURL(txtBlob);
      const txtLink = document.createElement('a');
      txtLink.href = txtUrl;
      txtLink.download = `upwork-chat-${safeName}-${dateStr}.txt`;
      document.body.appendChild(txtLink);
      txtLink.click();
      document.body.removeChild(txtLink);
      URL.revokeObjectURL(txtUrl);
      console.log('[UCE][Output] TXT download triggered');

      const jsonBlob = new Blob([jsonOutput], { type: 'application/json;charset=utf-8' });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonLink = document.createElement('a');
      jsonLink.href = jsonUrl;
      jsonLink.download = `upwork-chat-${safeName}-${dateStr}.json`;
      document.body.appendChild(jsonLink);
      jsonLink.click();
      document.body.removeChild(jsonLink);
      URL.revokeObjectURL(jsonUrl);
      console.log('[UCE][Output] JSON download triggered');
    }

    // Copy text to clipboard
    try {
      await navigator.clipboard.writeText(txtOutput);
      console.log('[UCE] Text copied to clipboard');
    } catch (e) {
      console.warn('[UCE] Clipboard copy failed:', e.message);
    }

    ui.setProgress(100);
    ui.setStatus('Export complete!');
    ui.setDetail(`${data.messages.length} messages, ${downloadableFiles.length} files exported`);

    console.log('%c[UCE] ========== EXPORT COMPLETE ==========', 'color:#14a800;font-weight:bold;font-size:14px');
    console.log(`[UCE] Messages: ${data.messages.length}`);
    console.log(`[UCE] Files downloaded: ${downloadableFiles.length}`);
    console.log(`[UCE] First message: ${data.messages[0]?.date || 'unknown'} - ${data.messages[0]?.sender || 'unknown'}`);
    console.log(`[UCE] Last message: ${data.messages[data.messages.length - 1]?.date || 'unknown'} - ${data.messages[data.messages.length - 1]?.sender || 'unknown'}`);
    console.log(`[UCE] First message preview: "${data.messages[0]?.text?.substring(0, 100)}..."`);

    // Remove UI after 5 seconds
    setTimeout(() => ui.remove(), 5000);

  } catch (err) {
    console.error('%c[UCE] FATAL ERROR', 'color:red;font-weight:bold;font-size:14px');
    console.error('[UCE] Error:', err.message);
    console.error('[UCE] Stack:', err.stack);
    console.error('[UCE] Page state debug:');
    console.error('  URL:', window.location.href);
    console.error('  #story-viewport:', !!document.getElementById('story-viewport'));
    console.error('  .scroll-wrapper:', !!document.querySelector('.scroll-wrapper'));
    console.error('  .up-d-story-item count:', document.querySelectorAll('.up-d-story-item').length);
    console.error('  .up-d-room:', !!document.querySelector('.up-d-room'));
    console.error('  [data-test="room-title"]:', document.querySelector('[data-test="room-title"]')?.textContent);
    ui.setStatus('Export failed!');
    ui.setDetail(err.message);
    setTimeout(() => ui.remove(), 10000);
  }
})();
