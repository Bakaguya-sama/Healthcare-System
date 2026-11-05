# Bản đồ kế hoạch

## Nguồn kế hoạch hiện hành

[`roadmap.md`](roadmap.md) là roadmap implementation duy nhất. Mỗi slice phải
đọc cùng `docs/chronic-care-spec.md`, `docs/product-spec.md`, DBML/migration và
exit gate tương ứng.

`archive/` chỉ lưu lịch sử, evidence và kế hoạch đã được thay thế. Không dùng
archive làm nguồn cho command behavior, permission, state transition hoặc HTTP
DTO mới.

## File roles

| File                                     | Role                                                               |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `roadmap.md`                             | Current implementation roadmap and release gates                   |
| `archive/refactor-history.md`            | Refactor history, platform dependency summary and cut-line context |
| `../docs/project/da2-proposal.md`        | Đề cương/phạm vi DA2 hiện hành                                     |
| `../docs/project/da2-overview.md`        | Tổng quan nghiệp vụ DA2                                            |
| `archive/readiness-review-2026-09-28.md` | Historical readiness assessment                                    |
| `archive/preflight-checklist.md`         | Historical RF decision record                                      |
| `archive/roadmap-legacy-2026-11-03.md`   | Roadmap dài trước khi rebaseline ngày 03/11                        |
| `archive/cc-pay-001-tracker.md`          | Evidence lịch sử của `CC-PAY-001`; gate đã đóng                    |
| `rag-upgrade-blueprint.md`               | Specialized AI/RAG design input for the later AI slice             |

Khi tài liệu khác xung đột với `docs/chronic-care-spec.md`,
`docs/product-spec.md` hoặc `roadmap.md`, coi đó là documentation defect cần sửa
trước khi code; không để implementer tự chọn phiên bản.
