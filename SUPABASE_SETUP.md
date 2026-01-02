# Thiết lập Supabase

Để ứng dụng hoạt động, bạn cần thiết lập Database trên Supabase theo các bước sau:

1.  **Tạo bảng `moods`**:
    Chạy câu lệnh SQL sau trong SQL Editor của Supabase:

    ```sql
    create table moods (
      id bigint primary key generated always as identity,
      mood_level int default 50,
      last_updated timestamptz default now()
    );

    -- Chèn dòng dữ liệu khởi tạo (chúng ta dùng id=1 để lưu trạng thái chung)
    insert into moods (mood_level) values (50);

    -- Bật Realtime cho bảng này
    alter publication supabase_realtime add table moods;
    ```

2.  **Lấy API Keys**:
    *   Vào Project Settings -> API.
    *   Copy `Project URL` và `anon` `public` key.
    *   Dán vào file `.env.local` (đổi tên từ `.env.local.example`).

3.  **Lưu ý về Realtime**:
    *   Đảm bảo bạn đã bật Realtime Replication cho bảng `moods`.

4.  **Chạy dự án**:
    ```bash
    npm run dev
    ```
