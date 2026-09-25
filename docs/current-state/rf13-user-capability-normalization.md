# RF-13 — Chuẩn hóa capability Doctor/Patient trong Users

Status: **DONE — 2026-09-21** (`BE-RF-094` đến `BE-RF-095`).

## Vấn đề

RF-11 đã hợp nhất các top-level module vào `UsersModule`, nhưng physical layout bên trong chưa đồng nhất: doctor query/schema/DTO nằm rải ở root trong khi patient còn nguyên thư mục legacy. Patient profile đồng thời được triển khai trong cả `UsersService` và `PatientsService`, tạo hai nhóm API và hai owner cho cùng collection.

## Kết quả

- `users/doctors` chứa doctor directory, DTO và embedded doctor-profile schema. Đây là capability folder nội bộ, không phải `DoctorsModule` hoặc collection `doctors` mới.
- `users/patients` chứa duy nhất `PatientProfileController`, `PatientProfileService`, query DTO và schema.
- Embedded admin-profile schema nằm cùng capability `users/admins`; shared User/address schema tiếp tục nằm ở `users/entities`.
- `UsersService` không còn inject hoặc thao tác Patient model.
- Patient persistence class được đổi thành `PatientProfile`; schema khai báo rõ `collection: 'patients'`, vì vậy không đổi physical collection và không cần data migration.
- `PatientProfileService` kiểm tra canonical `User.role = patient` trước khi tạo profile.
- Service không được export khỏi `UsersModule` vì chưa có consumer cross-context.
- Alias `users/enums/user-role.enum.ts` đã bị xóa; core, infrastructure và Users cùng import canonical enum từ `core/domain/user.enums.ts`, loại dependency ngược `core → feature`.

## API canonical

| Method | Path | Quyền | Mục đích |
| --- | --- | --- | --- |
| `POST` | `/api/v1/patients/me` | Patient | Tạo profile cho user hiện tại |
| `GET` | `/api/v1/patients/me` | Patient | Đọc profile của user hiện tại |
| `DELETE` | `/api/v1/patients/me` | Patient | Xóa profile của user hiện tại |
| `GET` | `/api/v1/patients` | Admin | Danh sách có pagination và stable sort |

Đã xóa `/users/profile`, `/patients/profile` và `PATCH` patient profile rỗng. Thay đổi contract được chấp nhận vì frontend mới sẽ tích hợp canonical API.

## Verification

- Patient profile unit tests kiểm tra happy path, sai role/user và duplicate profile.
- TypeScript typecheck và API build pass.
- Unit: 14 suites / 59 tests pass.
- Integration: 5 suites / 13 tests pass.
- E2E: 1 suite / 4 tests pass.
- Boundary và realtime contract checks pass.
- ESLint: 0 errors / 269 warnings, dưới repository budget 402; RF-13 không thêm warning mới.
- OpenAPI runtime generation/check pass.
- OpenAPI runtime artifact đã được tạo lại theo canonical routes.
