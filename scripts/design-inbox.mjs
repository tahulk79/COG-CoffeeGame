#!/usr/bin/env node
// Hộp thư thiết kế: báo các thay đổi tài liệu thiết kế và ý tưởng mới trên nhánh chung kể từ lần đã xem.
//
//   node scripts/design-inbox.mjs            xem báo cáo
//   node scripts/design-inbox.mjs --ack      đánh dấu đã xem tới commit mới nhất của nhánh chung
//   node scripts/design-inbox.mjs --hook     dùng cho hook đầu phiên Claude Code (im lặng khi không có gì mới)
//   --remote <tên> --branch <tên>            mặc định cog / main, hoặc biến môi trường DESIGN_REMOTE, DESIGN_BRANCH
//   --no-fetch                               không gọi git fetch (dùng dữ liệu đã có)
//   --since <rev> --ref <rev>                báo những gì vừa vào máy, ví dụ sau pull: --since ORIG_HEAD --ref HEAD
//                                            (hook git post-merge trong .githooks/ gọi kiểu này)
//
// Mốc "đã xem" lưu trong .git/design-inbox.json, không commit vào repo.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const argv = process.argv.slice(2);
const flag = name => argv.includes(`--${name}`);
const option = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback; };
const REMOTE = option('remote', process.env.DESIGN_REMOTE || 'cog');
const BRANCH = option('branch', process.env.DESIGN_BRANCH || 'main');
const SINCE = option('since', '');
const REF = option('ref', `${REMOTE}/${BRANCH}`);
const LOCAL = argv.includes('--ref');
const HOOK = flag('hook');
const WATCH = ['docs/design', 'docs/screens', 'docs/shared', 'docs/game-flow.md'];
const IDEAS = 'docs/design/ideas';
const CHANGES = 'docs/design/changes';
const PROGRESS = 'docs/design/progress';
const GDD = 'docs/design/godbean-gdd.md';
const OPEN_STATES = ['Mới', 'Đang xem'];
const OPEN_CHANGES = ['Chờ dev', 'Đang làm'];

function git(args, { timeout = 15000 } = {}) {
  const r = spawnSync('git', args, { encoding: 'utf8', timeout });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() || (r.error ? String(r.error.message) : '') };
}
function quit(message) { if (!HOOK) console.log(message); process.exit(0); }

if (!git(['rev-parse', '--git-dir']).ok) quit('Không ở trong repo git.');
const stateFile = git(['rev-parse', '--git-path', 'design-inbox.json']).out;
const readState = () => { try { return JSON.parse(readFileSync(stateFile, 'utf8')); } catch { return {}; } };

let fetchNote = '';
if (!flag('no-fetch') && !LOCAL) {
  const f = git(['fetch', '--quiet', REMOTE, BRANCH], { timeout: 10000 });
  if (!f.ok) fetchNote = `⚠️ Không fetch được ${REF} (${f.err.split('\n')[0] || 'hết giờ'}); báo cáo dùng dữ liệu đã có.`;
}
const tip = git(['rev-parse', '--verify', '--quiet', `${REF}^{commit}`]).out;
if (!tip) quit(`Chưa có nhánh ${REF}. Kiểm tra tên remote/nhánh (--remote, --branch). ${fetchNote}`);

const state = readState();
const key = REF;
if (flag('ack')) {
  state[key] = { commit: tip, at: new Date().toISOString() };
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log(`Đã đánh dấu đã xem ${REF} tới ${tip.slice(0, 7)}.`);
  process.exit(0);
}

const seen = SINCE ? git(['rev-parse', '--verify', '--quiet', `${SINCE}^{commit}`]).out : state[key]?.commit;
const seenValid = !!seen && git(['cat-file', '-e', `${seen}^{commit}`]).ok;
if (SINCE && !seenValid) quit(`[Hộp thư thiết kế] Không tìm thấy mốc ${SINCE}; chạy lại không kèm --since để xem so với mốc đã xem.`);
const range = seenValid ? `${seen}..${REF}` : null;

// Commit chạm tài liệu thiết kế kể từ mốc đã xem (lần đầu: 10 commit gần nhất).
// Commit do chính người dùng máy này viết (vd. PR của mình vừa được merge vào repo chung) được đánh dấu, không tính là tin mới.
const myEmail = git(['config', 'user.email']).out.toLowerCase();
const mine = email => !!myEmail && email.toLowerCase() === myEmail;
const logArgs = ['log', '--format=%h|%ae|%an|%ad|%s', '--date=short', ...(range ? [range] : ['-n', '10', REF]), '--', ...WATCH];
const commits = git(logArgs).out.split('\n').filter(Boolean).map(line => { const [hash, email, author, date, ...s] = line.split('|'); return { hash, author, date, subject: s.join('|'), mine: mine(email) }; });
const othersCommits = range ? git(['log', '--format=%ae', range]).out.split('\n').filter(e => e && !mine(e)).length : 0;
const files = range ? git(['diff', '--name-status', seen, REF, '--', ...WATCH]).out.split('\n').filter(Boolean) : [];

// Ý tưởng, phiếu sửa, báo cáo tiến độ: đọc thẳng từ nhánh chung (kể cả khi chưa merge về máy).
const field = (text, name) => (text.match(new RegExp(`^\\|\\s*${name}\\s*\\|\\s*([^|]*?)\\s*\\|`, 'm')) || [])[1] || '';
const changedIn = new Map(files.map(l => { const [s, ...p] = l.split('\t'); return [p.pop(), s[0] === 'A' ? '🆕' : '✏️']; }));
const readDocs = dir => git(['ls-tree', '-r', '--name-only', REF, '--', dir]).out.split('\n')
  .filter(p => p.endsWith('.md') && !/\/(README|_template)\.md$/.test(p))
  .map(path => {
    const text = git(['show', `${REF}:${path}`]).out;
    return { path, title: (text.match(/^#\s+(.+)$/m) || [])[1] || path, status: field(text, 'Trạng thái'), by: field(text, 'Người đề xuất') || field(text, 'Người yêu cầu') || field(text, 'Người báo'), date: field(text, 'Ngày'), note: field(text, 'Cập nhật'), mark: changedIn.get(path) || '' };
  });
const ideas = readDocs(IDEAS);
const changes = readDocs(CHANGES);
const reports = readDocs(PROGRESS).sort((a, b) => b.path.localeCompare(a.path));
// Code và phần còn lại ngoài tài liệu thiết kế: gom theo thư mục để biết code đã đổi ở đâu.
const otherFiles = range ? git(['diff', '--name-only', seen, REF, '--', '.', ...WATCH.map(p => `:(exclude)${p}`)]).out.split('\n').filter(Boolean) : [];
const byFolder = otherFiles.reduce((m, p) => { const k = p.split('/').slice(0, p.startsWith('src/') ? 3 : 1).join('/'); m[k] = (m[k] || 0) + 1; return m; }, {});
const otherCommits = range ? Number(git(['rev-list', '--count', range]).out || 0) : 0;
const openIdeas = ideas.filter(i => OPEN_STATES.includes(i.status));
const touchedIdeas = ideas.filter(i => i.mark);
const quietOpenIdeas = openIdeas.filter(i => !i.mark);
const openChanges = changes.filter(c => OPEN_CHANGES.includes(c.status) || c.mark);
const newReports = range ? reports.filter(r => r.mark) : reports.slice(0, 1);
const STRUCTURED = [IDEAS, CHANGES, PROGRESS].map(d => `${d}/`);
const otherDocFiles = files.filter(l => !STRUCTURED.some(d => l.split('\t').pop().startsWith(d)));

// Phiên bản GDD: nhánh chung so với máy hiện tại.
const version = text => field(text, 'Phiên bản');
const remoteGdd = version(git(['show', `${REF}:${GDD}`]).out);
const localGdd = existsSync(GDD) ? version(readFileSync(GDD, 'utf8')) : '';
const head = git(['rev-parse', 'HEAD']).out;
const behind = git(['rev-list', '--count', `HEAD..${REF}`]).out;

const hasNews = commits.some(c => !c.mine) || othersCommits > 0 || openIdeas.some(i => i.status === 'Mới') || changes.some(c => c.status === 'Chờ dev');
if (HOOK && seenValid && !hasNews) process.exit(0);
if (SINCE && !hasNews) quit(`[Hộp thư thiết kế] Lần đồng bộ này không có commit mới từ ${SINCE.slice(0, 12)}.`);

const lines = [];
lines.push(HOOK
  ? `[Hộp thư thiết kế] Có thay đổi mới trên ${REF}. BÁO NGƯỜI DÙNG NGAY ở đầu câu trả lời (theo AGENTS.md), trước khi làm việc khác; không tự triển khai ý tưởng chưa chốt.`
  : SINCE ? `# Hộp thư thiết kế — vừa đồng bộ về ${REF}` : `# Hộp thư thiết kế — ${REF}`);
if (fetchNote) lines.push(fetchNote);
lines.push(SINCE ? `Khoảng: ${seen.slice(0, 7)} → ${tip.slice(0, 7)}.`
  : seenValid ? `Mốc đã xem: ${seen.slice(0, 7)} (${state[key].at?.slice(0, 10) || '?'}) → mới nhất ${tip.slice(0, 7)}.` : `Chưa có mốc đã xem; hiện 10 commit tài liệu gần nhất. Xem xong chạy: node scripts/design-inbox.mjs --ack`);
if (!LOCAL) lines.push(`Máy hiện tại ${behind && behind !== '0' ? `chậm ${behind} commit so với ${REF}` : `đã có đủ ${REF}`} (HEAD ${head.slice(0, 7)}).`);
if (range) lines.push(`Tổng: ${otherCommits} commit (${othersCommits} của người khác); ${files.length} file tài liệu thiết kế, ${otherFiles.length} file khác thay đổi.`);
if (remoteGdd && remoteGdd !== localGdd) lines.push(`GDD trên ${REF}: phiên bản ${remoteGdd}; máy hiện tại: ${localGdd || 'chưa có'}. Xem "Lịch sử phiên bản" trong ${GDD}.`);

const item = d => `- ${d.mark ? `${d.mark} ` : ''}${d.status ? `[${d.status}] ` : ''}${d.title} — ${d.by || '?'}, ${d.date || '?'}${d.note ? `\n  ↳ ${d.note}` : ''}\n  (${d.path})`;
lines.push('', `## Tiến độ ${range ? 'mới' : 'gần nhất'} (${newReports.length})`);
lines.push(newReports.length ? newReports.map(item).join('\n') : '- Không có báo cáo mới');

lines.push('', `## Ý tưởng mới / vừa đổi (${touchedIdeas.length})`);
lines.push(touchedIdeas.length ? touchedIdeas.map(item).join('\n') : '- Không có');
if (quietOpenIdeas.length) lines.push(`Còn mở, không đổi: ${quietOpenIdeas.map(i => `${i.title} [${i.status}]`).join('; ')}`);

lines.push('', `## Phiếu sửa tài liệu cần làm / vừa đổi (${openChanges.length})`);
lines.push(openChanges.length ? openChanges.map(item).join('\n') : '- Không có');

if (otherDocFiles.length) lines.push('', '## Tài liệu khác thay đổi', otherDocFiles.map(l => { const [s, ...p] = l.split('\t'); return `- ${({ A: 'thêm', M: 'sửa', D: 'xóa' })[s[0]] || s} ${p.join(' → ')}`; }).join('\n'));
if (otherFiles.length) lines.push('', '## Code và file khác thay đổi (theo thư mục)', Object.entries(byFolder).sort((a, b) => b[1] - a[1]).map(([k, n]) => `- ${k}: ${n} file`).join('\n'));

const othersDocCommits = commits.filter(c => !c.mine);
lines.push('', `## Commit tài liệu ${range ? 'mới' : 'gần nhất'} của người khác (${othersDocCommits.length}${commits.length > othersDocCommits.length ? `; bỏ qua ${commits.length - othersDocCommits.length} của bạn` : ''})`);
lines.push(othersDocCommits.length ? othersDocCommits.map(c => `- ${c.hash} ${c.date} ${c.author}: ${c.subject}`).join('\n') : '- Không có');

if (!SINCE) lines.push('', HOOK ? 'Sau khi người dùng đã xem, họ (hoặc agent theo yêu cầu của họ) chạy: node scripts/design-inbox.mjs --ack' : 'Đã xem xong: node scripts/design-inbox.mjs --ack');
console.log(lines.join('\n'));
