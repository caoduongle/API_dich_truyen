/**
 * Direct Translation Engine (Client-Direct Pipeline)
 * Facade chuyển tiếp toàn bộ lời gọi tới các mô-đun chuyên biệt trong src/services/translation/
 * Duy trì tính tương thích ngược 100% cho toàn bộ mã nguồn và test suite.
 */

export * from './translation/index';
