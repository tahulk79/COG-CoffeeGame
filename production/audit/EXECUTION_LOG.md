# EXECUTION LOG

## Game Studios framework — đánh giá tương thích

Nguồn: README, `CLAUDE.md`, `.claude/settings.json`, danh sách `.claude/agents` và `.claude/skills`, `skills/playtest-report/SKILL.md` của https://github.com/Donchitos/Claude-Code-Game-Studios (đọc qua WebFetch/GitHub API ngày 2026-11-04). Không cài, không sửa `.claude/`.

### Framework là gì
Template cả repo: `CLAUDE.md` gốc + `.claude/{settings.json, agents (49), skills (72–74), hooks (15), rules (14), docs, statusline.sh}` + cây `design/ src/ assets/ production/ ...`. Nhắm Godot/Unity/Unreal (`CLAUDE.md` để engine là placeholder, `@docs/engine-reference/godot/VERSION.md`), cần Python 3 + `project.yaml`. Cài = clone/copy cả repo, không có installer chọn phần.

### Dự án hiện có
- Không có `CLAUDE.md` gốc; luật nằm ở `AGENTS.md` (không tự test/build/preview, game không phải web, modal/dải giống...).
- `.claude/agents` (10): asset-3d, cafe-dev, economy-integrator, farm-dev, game-designer, gameplay-reviewer, playtester, sound-designer, ui-stylist, vfx-artist.
- `.claude/skills` (4): balance-check, design-review, game-team, threejs-h5-performance-engineer (+ scripts bench-init.js, glbinfo.py, heapdiff.py, imgdiff.py, tracetop.py).
- `settings.local.json`: chỉ allow `Bash(git add *)`; không có `settings.json`, không có hooks dự án. Global `~/.claude/settings.json` có hook `PreToolUse`, `SessionStart`.

### Xung đột (không tích hợp nguyên trạng)
| Loại | Chi tiết | Mức |
|---|---|---|
| Agent trùng tên | `game-designer`, `sound-designer` — copy sẽ ghi đè bản tiếng Việt đã gắn dự án | Cao |
| Agent trùng vai | economy-designer↔economy-integrator, qa-tester↔playtester, technical-artist↔vfx-artist/asset-3d, ui-programmer/ux-designer↔ui-stylist, gameplay-programmer↔farm-dev/cafe-dev, lead-programmer↔gameplay-reviewer | Trung bình (rối điều phối) |
| Skill trùng tên | `/balance-check`, `/design-review` — bản framework đọc `design/gdd/`, bản dự án đọc `docs/design/` + code thật | Cao |
| CLAUDE.md | Quy trình "hỏi trước mọi lần ghi file", 49 agent, import Godot; đá với `/game-team` (tự quyết, chỉ bàn giao cuối) và với `AGENTS.md` | Cao |
| Hooks | `validate-commit.sh` soi hardcoded/TODO/doc sections (không theo Conventional Commits + footer `Lark-Task` của người dùng); `validate-read.sh` chặn đọc doc >40KB; `notify.sh` là toast Windows; `session-stop.sh`/`log-agent*.sh` ghi `production/session-state/` mỗi lượt; các matcher PowerShell vô dụng trên macOS; chạy cộng dồn với hook global | Cao |
| settings.json | `allow: python -m pytest` (vô nghĩa với `node --test`); `deny` 105 mục (rm -rf, push --force, reset --hard, đọc `.env`) — trùng tinh thần luật an toàn của người dùng | Thấp (deny an toàn) |
| Cây thư mục | Framework dùng `design/`, `production/qa/`, `production/session-state/`; dự án dùng `docs/design/`, `production/audit/` | Trung bình |
| Rules path-scoped | `src/gameplay/**`, `src/core/**`, `*.tscn` — không khớp `src/features/**` | Thấp (không kích hoạt) |

### Tích hợp an toàn (nếu muốn, chép tay có chọn lọc)
- Danh sách `deny` trong `settings.json` (lọc bỏ PowerShell) — chỉ thêm rào chắn, không đổi hành vi.
- Ý tưởng/khung báo cáo của vài skill độc lập tên: `/playtest-report` (engine-agnostic, nhưng cần ghi chú playtest **của người**, không tự chạy game; ghi `production/qa/playtests/`), `/qa-plan`, `/regression-suite`, `/soak-test`, `/ux-review`, `/gate-check` — phải viết lại đường dẫn sang `docs/design/`, bỏ phụ thuộc `project.yaml`/`yaml-helper.sh`, bỏ bước spawn `creative-director`.
- Không nên chép: CLAUDE.md, hooks, agents trùng, engine specialists, `/team-*` (đè vai `/game-team`).

### Workflow được hỏi — đã có tương đương chưa
| Workflow framework | Tương đương trong dự án | Ghi chú |
|---|---|---|
| /playtest-report | Một phần: agent `playtester` (chạy thử qua Browser, chỉ trong `/game-team`) | Framework phân tích ghi chú người chơi; dự án tự chơi bằng AI (AI heuristic, không phải human playtest). Thiếu template báo cáo playtest. |
| /balance-check | Có, cùng tên: skill `balance-check` | Bản dự án hợp hơn (đọc số trong code). |
| /qa-plan | Chưa | `/game-team` có checklist playtester nhưng không có plan QA riêng. |
| /team-qa | Một phần: `/game-team` bước 4–5 (reviewer + playtester, tối đa 2 vòng) | |
| /perf-profile | Có: `threejs-h5-performance-engineer` (bench-init, tracetop) | Bản dự án chuyên Three.js mobile, sâu hơn. |
| /soak-test | Một phần: bước rò rỉ của skill perf (10 vòng chuyển màn + heapdiff, SKILL.md:44) | Không có soak theo thời gian dài. |
| /ux-review | Một phần: `ui-stylist` + luật UI trong AGENTS.md; `design-review flow` | Chưa có skill ux-review riêng. |
| /asset-audit | Có: skill perf mục assets (`glbinfo.py`, `imgdiff.py`, SKILL.md:45,62-63) + agent `asset-3d` | Thiếu kiểm tên/quy ước asset. |
| /regression-suite | Một phần: `tests/` 33 test logic (`node --test tests/*.test.js`), không có script `test`, không có suite UI/cafe | |
| /gate-check | Chưa | Người dùng tự là gate (2 lần dừng trong quy trình Lark). |

### Kết luận
Không nên cài framework nguyên trạng: 2 agent + 2 skill trùng tên sẽ ghi đè bản đã gắn dự án, CLAUDE.md và 15 hooks đá với `AGENTS.md`/quy trình `/game-team` và hook global, đa phần nội dung nhắm Godot/Unity/Unreal. Giá trị thực: danh sách `deny` và khung báo cáo của `/qa-plan`, `/regression-suite`, `/soak-test`, `/ux-review`, `/gate-check`, `/playtest-report` — nếu dùng thì viết lại thành skill tiếng Việt mới, tên không trùng, sau khi người dùng duyệt.

## Checkpoint 2026-11-04 — vòng 1 xong
- Nhánh `audit/game-studio-playtest-optimization` từ `d8fdf77`; working tree giữ nguyên thay đổi chưa commit của người dùng; `src/` chưa sửa.
- Workflow `wf_3a479977-f3b`: 14 agent (5 tĩnh, 4 playtest, 5 phản biện P1). Không có P0; các P1 hạ còn P2 sau phản biện.
- Dev server cục bộ cổng 5174. chrome-devtools MCP bị khóa profile → perf/UX dùng Chrome riêng qua CDP; Test A/C/D/E dùng pane nội bộ (fps thấp, chỉ tin kết quả chức năng).
- Bước tiếp: chờ người dùng duyệt đợt sửa trong `12_FINAL_RECOMMENDATIONS.md`.

## Checkpoint 2026-11-04 — đợt sửa 1 xong
- Workflow `wf_a3280064-c68` (11 agent): sửa 8 mục, review đối kháng, regression, đo lại (07_PERFORMANCE_AFTER.md). M1 làm qua bước cross-file bằng cờ `userData.cached`.
- Producer sửa thêm 3 điểm (xem 11). Chưa commit — chờ người dùng duyệt; working tree lẫn thay đổi cũ của người dùng.
