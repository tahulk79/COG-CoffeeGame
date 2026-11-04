# Agent

File: `.claude/agents/<tên>.md`. Thân agent là bản gốc tiếng Anh của CCGS; cuối mỗi file có mục **Godbean adaptation (local)** ghi trách nhiệm, giới hạn, sản phẩm bàn giao, điều kiện xong.

## 8 agent chính

| Agent | Model | Công cụ | Ghi file? | Phạm vi |
|---|---|---|---|---|
| game-designer | opus | Read, Glob, Grep, Write, Edit, WebSearch | Tài liệu | Vòng chơi, tiến trình, nhiệm vụ, hướng dẫn, bản đồ thế giới, giữ chân |
| economy-designer | sonnet | Read, Glob, Grep, Write, Edit | Tài liệu | Xu, giá, doanh thu quán, chi phí nâng cấp/thuê/tự động, mô phỏng. Kiến trúc kinh tế lớn → phiên chính gọi game-designer (opus) |
| ux-designer | sonnet | Read, Glob, Grep, Write, Edit, WebSearch | Tài liệu | HUD, điều hướng, onboarding, chạm, a11y |
| gameplay-programmer | sonnet | Read, Glob, Grep, Write, Edit, Bash | `src/`, `tests/` | Code gameplay, state, farm, quán, tự động, sửa lỗi, tương thích save |
| technical-artist | sonnet | Read, Glob, Grep, Write, Edit, Bash | asset, `tools/`, `src/shared/three|vfx` | Blender/Meshy, vật liệu, shader, VFX, ánh sáng, tối ưu asset |
| performance-analyst | sonnet | Read, Glob, Grep, Bash | **Không** | FPS, draw call, bộ nhớ, tải asset. Chỉ đo và đề xuất; kiến trúc khó → opus |
| qa-tester | haiku | Read, Glob, Grep, Bash | **Không** | Chạy test, hồi quy, tóm tắt, bước tái hiện. Lỗi khó → gọi lại với `model: sonnet` |
| producer | sonnet | Read, Glob, Grep, Bash | **Không** | Chia việc, kế hoạch giao việc, phụ thuộc, cổng chất lượng |

`designer` agent bị chặn Bash (`disallowedTools: Bash`) nên không chạy lệnh.

## 5 agent phụ (skill upstream gọi tới)

engine-programmer, tools-programmer, sound-designer, art-director (model theo phiên), creative-director (opus). Giữ nguyên bản gốc.

## Giới hạn quan trọng

- **Subagent không gọi được subagent khác.** Chỉ phiên chính (hoặc skill chạy trong phiên chính như `/game-studio`, `/team-qa`) mới giao việc. `producer` chỉ trả kế hoạch.
- Tối đa 3 agent chạy cùng lúc; chạy song song chỉ khi không đụng chung file.
- Agent không được bịa số đo/kết quả test.
