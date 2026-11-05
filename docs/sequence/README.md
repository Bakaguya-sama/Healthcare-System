# Sequence diagram map

Các file PlantUML trong thư mục này là tài liệu phân tích luồng, không phải bằng
chứng feature đã được triển khai. Khi diagram khác runtime contract, source,
OpenAPI và `docs/integration-contract.md` hiện hành có ưu tiên cao hơn.

## Trạng thái theo nhóm

| Diagram                                           | Trạng thái 03/11/2026                                         | Ghi chú                                                          |
| ------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `01`–`14`, `18`, `20`, `26`, `28`–`31`, `36`–`40` | Có backend một phần hoặc đầy đủ                               | Phải đối chiếu endpoint canonical; frontend không nằm trong repo |
| `15`                                              | Backend payment đã có; Patient billing read surface còn thiếu | Slice chuẩn: `CC-PAY-001`                                        |
| `16`–`19`, `32`–`34`                              | Chronic Care core đã có; read/export/page flow còn thiếu      | Export vẫn P0 DA2                                                |
| `23`–`25`, `27`, `35`                             | P0 DA2 chưa hoàn tất                                          | Availability Slot, scheduled booking, check-in và queue          |
| `21`                                              | P1                                                            | Người thân đồng hành                                             |
| `22`                                              | P1                                                            | Tìm cơ sở y tế                                                   |

## Quy tắc cập nhật

- Ghi đúng HTTP method/path từ OpenAPI đã regenerate.
- Mỗi diagram của feature chưa có source phải ghi `P0 chưa hoàn tất`, `P1` hoặc
  `Hậu DA2` ngay dưới title.
- Không mô tả WebRTC, Mobile, family, facility, export hay operations KPI là
  runtime-ready khi chưa có code/test tương ứng.
