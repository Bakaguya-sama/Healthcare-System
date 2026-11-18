# Sequence diagram map

Các file PlantUML trong thư mục này là tài liệu phân tích luồng, không phải bằng
chứng feature đã được triển khai. Khi diagram khác runtime contract, source,
OpenAPI và `docs/integration-contract.md` hiện hành có ưu tiên cao hơn.

## Trạng thái theo nhóm

| Diagram                                           | Trạng thái 17/11/2026                                      | Ghi chú                                                          |
| ------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `01`–`14`, `18`, `20`, `26`, `28`–`31`, `36`–`40` | Có backend một phần hoặc đầy đủ                            | Phải đối chiếu endpoint canonical; frontend không nằm trong repo |
| `15`                                              | Backend subscription payment và Patient billing read đã có | Refund/payment return UI là follow-up P1/repo frontend           |
| `16`–`19`, `32`–`34`                              | Chronic Care core, read và export backend đã có            | Consumer page flow cần ghép tại frontend repository              |
| `23`, `25`, `27`, `35`                            | Scheduled booking/check-in/queue backend đã có             | Unified on-demand queue và ETA là follow-up hậu DA2              |
| `24`                                              | On-demand consultation core có backend                     | Unified queue/policy vận hành chưa thuộc DA2                     |
| `21`                                              | P1                                                         | Người thân đồng hành                                             |
| `22`                                              | P1                                                         | Tìm cơ sở y tế                                                   |

## Quy tắc cập nhật

- Ghi đúng HTTP method/path từ OpenAPI đã regenerate.
- Mỗi diagram của feature chưa có source phải ghi `P0 chưa hoàn tất`, `P1` hoặc
  `Hậu DA2` ngay dưới title.
- Không mô tả WebRTC, Mobile, family, facility, export hay operations KPI là
  runtime-ready khi chưa có code/test tương ứng.
