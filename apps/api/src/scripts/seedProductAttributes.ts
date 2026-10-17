import { getPool, sql } from '../config/database.js'
import { indexProductCatalog } from '../services/ragIndexService.js'

type CategoryAttrDef = {
  name: string
  dataType: 'Text' | 'Number' | 'Boolean'
  unit?: string
  filterable: boolean
  searchable: boolean
}

const CATEGORY_ATTRIBUTES: Record<number, CategoryAttrDef[]> = {
  // Máy giặt (CategoryId: 6)
  6: [
    { name: 'Khối lượng giặt', dataType: 'Number', unit: 'kg', filterable: true, searchable: true },
    { name: 'Loại máy giặt', dataType: 'Text', filterable: true, searchable: true },
    { name: 'Công nghệ Inverter', dataType: 'Boolean', filterable: true, searchable: true },
    { name: 'Loại động cơ', dataType: 'Text', filterable: false, searchable: true },
    { name: 'Tốc độ vắt tối đa', dataType: 'Number', unit: 'vòng/phút', filterable: false, searchable: true },
    { name: 'Công suất tiêu thụ', dataType: 'Number', unit: 'W', filterable: false, searchable: true },
    { name: 'Tiện ích', dataType: 'Text', filterable: false, searchable: true },
    { name: 'Chất liệu lồng giặt', dataType: 'Text', filterable: false, searchable: false },
  ],
  // Máy lọc không khí (CategoryId: 7)
  7: [
    { name: 'Diện tích sử dụng', dataType: 'Number', unit: 'm²', filterable: true, searchable: true },
    { name: 'Lưu lượng gió (CADR)', dataType: 'Number', unit: 'm³/h', filterable: true, searchable: true },
    { name: 'Màng lọc bụi', dataType: 'Text', filterable: true, searchable: true },
    { name: 'Công suất hoạt động', dataType: 'Number', unit: 'W', filterable: false, searchable: true },
    { name: 'Độ ồn tối đa', dataType: 'Number', unit: 'dB', filterable: false, searchable: true },
    { name: 'Cảm biến', dataType: 'Text', filterable: false, searchable: true },
    { name: 'Kết nối ứng dụng thông minh', dataType: 'Boolean', filterable: true, searchable: true },
  ],
  // Robot hút bụi (CategoryId: 8)
  8: [
    { name: 'Lực hút', dataType: 'Number', unit: 'Pa', filterable: true, searchable: true },
    { name: 'Chức năng', dataType: 'Text', filterable: true, searchable: true },
    { name: 'Dung lượng pin', dataType: 'Number', unit: 'mAh', filterable: false, searchable: true },
    { name: 'Thời gian hoạt động', dataType: 'Number', unit: 'phút', filterable: false, searchable: true },
    { name: 'Trạm sạc OMNI tự động', dataType: 'Boolean', filterable: true, searchable: true },
    { name: 'Công nghệ điều hướng', dataType: 'Text', filterable: false, searchable: true },
    { name: 'Dung tích hộp bụi', dataType: 'Number', unit: 'ml', filterable: false, searchable: true },
    { name: 'Dung tích hộp nước', dataType: 'Number', unit: 'ml', filterable: false, searchable: true },
  ],
  // Tivi (CategoryId: 9)
  9: [
    { name: 'Kích thước màn hình', dataType: 'Number', unit: 'inch', filterable: true, searchable: true },
    { name: 'Độ phân giải', dataType: 'Text', filterable: true, searchable: true },
    { name: 'Công nghệ màn hình', dataType: 'Text', filterable: true, searchable: true },
    { name: 'Hệ điều hành', dataType: 'Text', filterable: true, searchable: true },
    { name: 'Tần số quét', dataType: 'Number', unit: 'Hz', filterable: true, searchable: true },
    { name: 'Tổng công suất loa', dataType: 'Number', unit: 'W', filterable: false, searchable: true },
    { name: 'Công nghệ âm thanh', dataType: 'Text', filterable: false, searchable: true },
    { name: 'Tính năng thông minh', dataType: 'Text', filterable: false, searchable: true },
  ],
  // Tủ lạnh (CategoryId: 10)
  10: [
    { name: 'Dung tích tổng', dataType: 'Number', unit: 'lít', filterable: true, searchable: true },
    { name: 'Kiểu tủ', dataType: 'Text', filterable: true, searchable: true },
    { name: 'Công nghệ Inverter', dataType: 'Boolean', filterable: true, searchable: true },
    { name: 'Công nghệ làm lạnh', dataType: 'Text', filterable: false, searchable: true },
    { name: 'Kháng khuẩn khử mùi', dataType: 'Text', filterable: false, searchable: true },
    { name: 'Ngăn đông mềm', dataType: 'Boolean', filterable: true, searchable: true },
    { name: 'Mức tiêu thụ điện', dataType: 'Number', unit: 'kWh/năm', filterable: false, searchable: true },
  ],
  // Quạt (CategoryId: 11)
  11: [
    { name: 'Loại quạt', dataType: 'Text', filterable: true, searchable: true },
    { name: 'Công suất', dataType: 'Number', unit: 'W', filterable: true, searchable: true },
    { name: 'Số cánh quạt', dataType: 'Number', unit: 'cánh', filterable: false, searchable: true },
    { name: 'Đường kính cánh', dataType: 'Number', unit: 'cm', filterable: false, searchable: true },
    { name: 'Điều khiển từ xa', dataType: 'Boolean', filterable: true, searchable: true },
    { name: 'Cấp độ gió', dataType: 'Number', unit: 'mức', filterable: false, searchable: true },
  ],
  // Nồi cơm điện (CategoryId: 12)
  12: [
    { name: 'Dung tích', dataType: 'Number', unit: 'lít', filterable: true, searchable: true },
    { name: 'Loại nồi', dataType: 'Text', filterable: true, searchable: true },
    { name: 'Công suất', dataType: 'Number', unit: 'W', filterable: true, searchable: true },
    { name: 'Chất liệu lòng nồi', dataType: 'Text', filterable: false, searchable: true },
    { name: 'Số người ăn', dataType: 'Text', filterable: true, searchable: true },
    { name: 'Chế độ nấu', dataType: 'Text', filterable: false, searchable: true },
    { name: 'Hẹn giờ nấu', dataType: 'Boolean', filterable: false, searchable: true },
  ],
  // Nồi chiên không dầu (CategoryId: 13)
  13: [
    { name: 'Dung tích', dataType: 'Number', unit: 'lít', filterable: true, searchable: true },
    { name: 'Công suất', dataType: 'Number', unit: 'W', filterable: true, searchable: true },
    { name: 'Nhiệt độ tối đa', dataType: 'Number', unit: '°C', filterable: false, searchable: true },
    { name: 'Công nghệ chiên', dataType: 'Text', filterable: false, searchable: true },
    { name: 'Bảng điều khiển', dataType: 'Text', filterable: false, searchable: true },
    { name: 'Cửa kính quan sát', dataType: 'Boolean', filterable: true, searchable: true },
    { name: 'Chất liệu lòng nồi', dataType: 'Text', filterable: false, searchable: true },
  ],
}

type ProductSpec = Record<string, string | number | boolean>

const PRODUCT_SPECS: Record<number, ProductSpec> = {
  // MÁY GIẶT
  25: { // Aqua 11 Kg AQW-FR110JT BK
    'Khối lượng giặt': 11,
    'Loại máy giặt': 'Cửa trên (Lồng đứng)',
    'Công nghệ Inverter': false,
    'Loại động cơ': 'Truyền động gián tiếp (Dây Curoa)',
    'Tốc độ vắt tối đa': 700,
    'Công suất tiêu thụ': 450,
    'Tiện ích': 'Khóa trẻ em, Tự khởi động lại khi có điện, Nắp kính cường lực tràn viền',
    'Chất liệu lồng giặt': 'Thép không gỉ Pillow',
  },
  26: { // Hitachi Inverter 10 Kg LTL 10MV00 GG
    'Khối lượng giặt': 10,
    'Loại máy giặt': 'Cửa trên (Lồng đứng)',
    'Công nghệ Inverter': true,
    'Loại động cơ': 'Động cơ biến tần Inverter',
    'Tốc độ vắt tối đa': 750,
    'Công suất tiêu thụ': 380,
    'Tiện ích': 'Thác nước đôi giặt sạch sâu, Chống xoắn rối quần áo, Khóa trẻ em',
    'Chất liệu lồng giặt': 'Thép không gỉ kháng khuẩn',
  },
  27: { // Toshiba Inverter 12 Kg AW-DUK1300KV
    'Khối lượng giặt': 12,
    'Loại máy giặt': 'Cửa trên (Lồng đứng)',
    'Công nghệ Inverter': true,
    'Loại động cơ': 'Truyền động trực tiếp Inverter (Origin Inverter)',
    'Tốc độ vắt tối đa': 770,
    'Công suất tiêu thụ': 400,
    'Tiện ích': 'Bọt khí siêu mịn Nano UFB, Đèn chiếu sáng lồng giặt, Hẹn giờ giặt',
    'Chất liệu lồng giặt': 'Thép không gỉ cao cấp',
  },
  28: { // Panasonic 8.5 Kg NA-F85A9BRV
    'Khối lượng giặt': 8.5,
    'Loại máy giặt': 'Cửa trên (Lồng đứng)',
    'Công nghệ Inverter': false,
    'Loại động cơ': 'Truyền động gián tiếp',
    'Tốc độ vắt tối đa': 700,
    'Công suất tiêu thụ': 420,
    'Tiện ích': 'Mâm giặt kháng khuẩn Ag+, Hệ thống tạo bọt Active Foam giặt sạch tinh tươm',
    'Chất liệu lồng giặt': 'Thép không gỉ Sazanami',
  },
  41: { // Máy giặt Aqua Inverter 10.5 Kg AQD-A1052J
    'Khối lượng giặt': 10.5,
    'Loại máy giặt': 'Cửa trước (Lồng ngang)',
    'Công nghệ Inverter': true,
    'Loại động cơ': 'Động cơ biến tần Inverter',
    'Tốc độ vắt tối đa': 1400,
    'Công suất tiêu thụ': 1800,
    'Tiện ích': 'Giặt hơi nước diệt khuẩn Steam Wash, Tự làm sạch mặt trong cửa Smart Dual Spray',
    'Chất liệu lồng giặt': 'Thép không gỉ gối hàn Laser',
  },
  59: { // Hitachi Inverter 10.5 kg BD-1054HVOW
    'Khối lượng giặt': 10.5,
    'Loại máy giặt': 'Cửa trước (Lồng ngang)',
    'Công nghệ Inverter': true,
    'Loại động cơ': 'Động cơ không chổi than Inverter',
    'Tốc độ vắt tối đa': 1400,
    'Công suất tiêu thụ': 1900,
    'Tiện ích': 'Giặt hơi nước diệt khuẩn 99.9%, Giặt sơ tự động, Giảm nhăn quần áo',
    'Chất liệu lồng giặt': 'Thép không gỉ',
  },
  60: { // LG Inverter 9 kg FB1209S5W
    'Khối lượng giặt': 9,
    'Loại máy giặt': 'Cửa trước (Lồng ngang)',
    'Công nghệ Inverter': true,
    'Loại động cơ': 'Truyền động trực tiếp AI DD bảo vệ sợi vải',
    'Tốc độ vắt tối đa': 1200,
    'Công suất tiêu thụ': 1700,
    'Tiện ích': 'Công nghệ giặt hơi nước Steam, Kết nối chẩn đoán thông minh Smart Diagnosis',
    'Chất liệu lồng giặt': 'Thép không gỉ kháng khuẩn 99%',
  },

  // MÁY LỌC KHÔNG KHÍ
  37: { // Xiaomi Smart Air Purifier 4 Lite
    'Diện tích sử dụng': 43,
    'Lưu lượng gió (CADR)': 360,
    'Màng lọc bụi': 'Màng lọc 3 lớp HEPA, than hoạt tính lọc bụi mịn PM2.5',
    'Công suất hoạt động': 33,
    'Độ ồn tối đa': 61,
    'Cảm biến': 'Cảm biến laser đo bụi mịn PM2.5, Nhiệt độ và Độ ẩm',
    'Kết nối ứng dụng thông minh': true,
  },
  38: { // LG PuriCare 360 Hit AS60GHWG0
    'Diện tích sử dụng': 60,
    'Lưu lượng gió (CADR)': 468,
    'Màng lọc bụi': 'Màng lọc đa màng HEPA H13, Than hoạt tính khử mùi độc hại',
    'Công suất hoạt động': 41,
    'Độ ồn tối đa': 53,
    'Cảm biến': 'Cảm biến bụi siêu mịn PM1.0 và khí Gas độc hại',
    'Kết nối ứng dụng thông minh': true,
  },
  39: { // Sharp FP-J30E-A
    'Diện tích sử dụng': 23,
    'Lưu lượng gió (CADR)': 180,
    'Màng lọc bụi': 'Màng lọc HEPA cao cấp kết hợp ion Plasmacluster mật độ cao',
    'Công suất hoạt động': 50,
    'Độ ồn tối đa': 44,
    'Cảm biến': 'Cảm biến bụi tự động điều chỉnh quạt',
    'Kết nối ứng dụng thông minh': false,
  },
  40: { // Philips AC0950/10
    'Diện tích sử dụng': 48,
    'Lưu lượng gió (CADR)': 300,
    'Màng lọc bụi': 'Màng lọc NanoProtect HEPA lọc hạt nhỏ đến 0.003 micron',
    'Công suất hoạt động': 30,
    'Độ ồn tối đa': 49,
    'Cảm biến': 'Cảm biến chất lượng không khí thông minh AeraSense',
    'Kết nối ứng dụng thông minh': true,
  },
  57: { // Electrolux EP32-25UGA 25W
    'Diện tích sử dụng': 26,
    'Lưu lượng gió (CADR)': 205,
    'Màng lọc bụi': 'Hệ thống lọc 4 bước kháng khuẩn và lọc bụi mịn PM2.5',
    'Công suất hoạt động': 25,
    'Độ ồn tối đa': 48,
    'Cảm biến': 'Cảm biến laser bụi PM2.5 hiển thị đèn LED 3 màu',
    'Kết nối ứng dụng thông minh': false,
  },
  58: { // Electrolux EP53-46UGA 40W
    'Diện tích sử dụng': 52,
    'Lưu lượng gió (CADR)': 415,
    'Màng lọc bụi': 'Màng lọc 5 lớp kháng khuẩn PureProtect lọc 99.9% vi khuẩn',
    'Công suất hoạt động': 40,
    'Độ ồn tối đa': 50,
    'Cảm biến': 'Cảm biến bụi mịn PM1.0, PM2.5, PM10 và hợp chất hữu cơ bay hơi VOC',
    'Kết nối ứng dụng thông minh': true,
  },

  // ROBOT HÚT BỤI
  33: { // Xiaomi Vacuum E5
    'Lực hút': 2000,
    'Chức năng': 'Hút bụi và lau nhà',
    'Dung lượng pin': 2600,
    'Thời gian hoạt động': 110,
    'Trạm sạc OMNI tự động': false,
    'Công nghệ điều hướng': 'Cảm biến con quay hồi chuyển Gyroscope và cảm biến va chạm',
    'Dung tích hộp bụi': 400,
    'Dung tích hộp nước': 90,
  },
  34: { // Xiaomi X20+
    'Lực hút': 6000,
    'Chức năng': 'Hút bụi và lau nhà xoay áp lực',
    'Dung lượng pin': 5200,
    'Thời gian hoạt động': 180,
    'Trạm sạc OMNI tự động': true,
    'Công nghệ điều hướng': 'Laser LDS 360 độ và tránh vật cản ánh sáng cấu trúc S-Cross',
    'Dung tích hộp bụi': 350,
    'Dung tích hộp nước': 4000,
  },
  35: { // Dreame D20 Ultra
    'Lực hút': 7000,
    'Chức năng': 'Hút bụi và lau nhà tự giặt sấy giẻ',
    'Dung lượng pin': 5200,
    'Thời gian hoạt động': 210,
    'Trạm sạc OMNI tự động': true,
    'Công nghệ điều hướng': 'AI Action Camera kết hợp Laser LDS thông minh',
    'Dung tích hộp bụi': 350,
    'Dung tích hộp nước': 4500,
  },
  36: { // Ecovacs Deebot N30 PRO OMNI
    'Lực hút': 10000,
    'Chức năng': 'Hút bụi siêu mạnh và lau xoay cạnh tường TruEdge',
    'Dung lượng pin': 5200,
    'Thời gian hoạt động': 200,
    'Trạm sạc OMNI tự động': true,
    'Công nghệ điều hướng': 'TrueDetect 3D 3.0 và LiDAR lập bản đồ TrueMapping 2.0',
    'Dung tích hộp bụi': 350,
    'Dung tích hộp nước': 4000,
  },
  55: { // Dreame D30 Ultra
    'Lực hút': 8300,
    'Chức năng': 'Hút bụi và lau nhà tự động xòe giẻ MopExtend',
    'Dung lượng pin': 6400,
    'Thời gian hoạt động': 260,
    'Trạm sạc OMNI tự động': true,
    'Công nghệ điều hướng': 'AI thông minh nhận diện hơn 80 loại chướng ngại vật',
    'Dung tích hộp bụi': 300,
    'Dung tích hộp nước': 4500,
  },

  // TIVI
  21: { // TCL Google TV QD-Mini LED 55C6KS 55 inch 4K
    'Kích thước màn hình': 55,
    'Độ phân giải': '4K Ultra HD (3840 x 2160)',
    'Công nghệ màn hình': 'QD-Mini LED Quantum Dot',
    'Hệ điều hành': 'Google TV',
    'Tần số quét': 144,
    'Tổng công suất loa': 35,
    'Công nghệ âm thanh': 'Dolby Atmos, Loa ONKYO 2.1 siêu trầm',
    'Tính năng thông minh': 'Trợ lý ảo Google Assistant tiếng Việt, AirPlay 2, Game Accelerator 240Hz',
  },
  22: { // Samsung Smart TV QLED QA65Q6FA 65 inch 4K
    'Kích thước màn hình': 65,
    'Độ phân giải': '4K Ultra HD (3840 x 2160)',
    'Công nghệ màn hình': 'QLED Quantum Dot 100% dải màu',
    'Hệ điều hành': 'Tizen OS',
    'Tần số quét': 60,
    'Tổng công suất loa': 20,
    'Công nghệ âm thanh': 'Object Tracking Sound Lite (OTS Lite), Q-Symphony',
    'Tính năng thông minh': 'Điều khiển SolarCell sạc năng lượng mặt trời, SmartThings Hub',
  },
  23: { // LG Smart TV NanoCell 55NANO80ASA 55 inch 4K
    'Kích thước màn hình': 55,
    'Độ phân giải': '4K Ultra HD (3840 x 2160)',
    'Công nghệ màn hình': 'NanoCell tinh khiết',
    'Hệ điều hành': 'webOS 24',
    'Tần số quét': 60,
    'Tổng công suất loa': 20,
    'Công nghệ âm thanh': 'AI Sound Pro 9.1.2 kênh ảo',
    'Tính năng thông minh': 'Chuột bay Magic Remote, Nhận diện giọng nói LG ThinQ AI',
  },
  24: { // Sony Google TV BRAVIA 2 II K-55S25VM2 55 inch 4K
    'Kích thước màn hình': 55,
    'Độ phân giải': '4K Ultra HD (3840 x 2160)',
    'Công nghệ màn hình': 'LED nền Direct LED, Bộ xử lý 4K Processor X1',
    'Hệ điều hành': 'Google TV',
    'Tần số quét': 60,
    'Tổng công suất loa': 20,
    'Công nghệ âm thanh': 'Dolby Audio, Loa cân bằng X-Balanced Speaker',
    'Tính năng thông minh': 'Tìm kiếm giọng nói rảnh tay Hands-free Voice Search, Chromecast',
  },
  42: { // Samsung AI 4K 65 inch QA65Q8F5
    'Kích thước màn hình': 65,
    'Độ phân giải': '4K Ultra HD (3840 x 2160)',
    'Công nghệ màn hình': 'QLED AI 4K nâng cấp hình ảnh bằng trí tuệ nhân tạo',
    'Hệ điều hành': 'Tizen OS 8.0',
    'Tần số quét': 120,
    'Tổng công suất loa': 40,
    'Công nghệ âm thanh': 'Dolby Atmos, Active Voice Amplifier Pro khuếch đại giọng nói',
    'Tính năng thông minh': 'AI Customization Mode, Bảo mật Samsung Knox, Điều khiển giọng nói tiếng Việt',
  },
  44: { // TCL AI 4K 55 inch 55P635
    'Kích thước màn hình': 55,
    'Độ phân giải': '4K Ultra HD (3840 x 2160)',
    'Công nghệ màn hình': 'LED HDR10',
    'Hệ điều hành': 'Google TV',
    'Tần số quét': 60,
    'Tổng công suất loa': 20,
    'Công nghệ âm thanh': 'Dolby Audio sống động',
    'Tính năng thông minh': 'Google Duo gọi video, Điều khiển giọng nói tiếng Việt không cần remote',
  },

  // TỦ LẠNH
  29: { // Samsung Inverter 236 lít RT22M4032BY/SV
    'Dung tích tổng': 236,
    'Kiểu tủ': 'Ngăn đá trên (Top Freezer)',
    'Công nghệ Inverter': true,
    'Công nghệ làm lạnh': 'Luồng khí lạnh đa chiều All-around Cooling',
    'Kháng khuẩn khử mùi': 'Bộ lọc than hoạt tính Deodorizer',
    'Ngăn đông mềm': true,
    'Mức tiêu thụ điện': 350,
  },
  30: { // Samsung Inverter 488 lít RF48A4010B4/SV
    'Dung tích tổng': 488,
    'Kiểu tủ': 'Multi Door (4 cánh sang trọng)',
    'Công nghệ Inverter': true,
    'Công nghệ làm lạnh': '2 dàn lạnh độc lập Twin Cooling Plus không lẫn mùi',
    'Kháng khuẩn khử mùi': 'Bộ lọc than hoạt tính Deodorizer',
    'Ngăn đông mềm': true,
    'Mức tiêu thụ điện': 510,
  },
  31: { // Aqua Inverter 358 lít AQR-T410FA
    'Dung tích tổng': 358,
    'Kiểu tủ': 'Ngăn đá trên (Top Freezer)',
    'Công nghệ Inverter': true,
    'Công nghệ làm lạnh': 'Làm lạnh 360 độ bảo quản thực phẩm đồng đều',
    'Kháng khuẩn khử mùi': 'Công nghệ DEO Fresh khử mùi ion bạc',
    'Ngăn đông mềm': false,
    'Mức tiêu thụ điện': 410,
  },
  32: { // LG Inverter 315 lít LTB31BLM
    'Dung tích tổng': 315,
    'Kiểu tủ': 'Ngăn đá trên (Top Freezer)',
    'Công nghệ Inverter': true,
    'Công nghệ làm lạnh': 'DoorCooling+ làm lạnh từ cánh cửa tủ, LinearCooling duy trì nhiệt độ',
    'Kháng khuẩn khử mùi': 'Bộ lọc than hoạt tính Nano Carbon',
    'Ngăn đông mềm': true,
    'Mức tiêu thụ điện': 380,
  },
  43: { // Toshiba Inverter 180 lít GR-B22VU UKG
    'Dung tích tổng': 180,
    'Kiểu tủ': 'Ngăn đá trên nhỏ gọn',
    'Công nghệ Inverter': true,
    'Công nghệ làm lạnh': 'Luồng khí lạnh vòng cung Air Fall Cooling',
    'Kháng khuẩn khử mùi': 'Ag+ Bio kháng khuẩn tối ưu',
    'Ngăn đông mềm': false,
    'Mức tiêu thụ điện': 310,
  },
  66: { // Haier Inverter 638 lít Multi Door HM800ASWMBVNU1
    'Dung tích tổng': 638,
    'Kiểu tủ': 'Multi Door (4 cánh cao cấp)',
    'Công nghệ Inverter': true,
    'Công nghệ làm lạnh': 'Làm lạnh đa chiều bảo toàn độ ẩm thực phẩm',
    'Kháng khuẩn khử mùi': 'Công nghệ khử khuẩn T-ABT 99.99%',
    'Ngăn đông mềm': true,
    'Mức tiêu thụ điện': 580,
  },

  // QUẠT
  45: { // Quạt hộp Senko 5 cánh BD230 28W
    'Loại quạt': 'Quạt hộp (quạt bàn nhỏ)',
    'Công suất': 28,
    'Số cánh quạt': 5,
    'Đường kính cánh': 20,
    'Điều khiển từ xa': false,
    'Cấp độ gió': 2,
  },
  46: { // Quạt treo tường Senko 3 cánh TR1628 47W
    'Loại quạt': 'Quạt treo tường',
    'Công suất': 47,
    'Số cánh quạt': 3,
    'Đường kính cánh': 40,
    'Điều khiển từ xa': true,
    'Cấp độ gió': 3,
  },
  47: { // Quạt lửng Lifan 3 cánh QL-316 45W
    'Loại quạt': 'Quạt lửng',
    'Công suất': 45,
    'Số cánh quạt': 3,
    'Đường kính cánh': 40,
    'Điều khiển từ xa': false,
    'Cấp độ gió': 3,
  },
  54: { // Quạt LG PuriCare AeroTower 40W
    'Loại quạt': 'Quạt tháp lọc không khí không cánh',
    'Công suất': 40,
    'Số cánh quạt': 0,
    'Đường kính cánh': 0,
    'Điều khiển từ xa': true,
    'Cấp độ gió': 10,
  },
  56: { // Quạt sàn Asia 5 cánh VY616990 55W
    'Loại quạt': 'Quạt sàn chân quỳ',
    'Công suất': 55,
    'Số cánh quạt': 5,
    'Đường kính cánh': 40,
    'Điều khiển từ xa': false,
    'Cấp độ gió': 3,
  },
  67: { // Quạt hộp Senko 5 cánh BD230 28W (bản dự phòng)
    'Loại quạt': 'Quạt hộp gia đình',
    'Công suất': 28,
    'Số cánh quạt': 5,
    'Đường kính cánh': 20,
    'Điều khiển từ xa': false,
    'Cấp độ gió': 2,
  },

  // NỒI CƠM ĐIỆN
  48: { // Sharp 1.8 lít KS-COM194EV-RD
    'Dung tích': 1.8,
    'Loại nồi': 'Nồi cơm điện tử',
    'Công suất': 790,
    'Chất liệu lòng nồi': 'Hợp kim nhôm phủ chống dính Daikin siêu bền',
    'Số người ăn': '4 - 6 người',
    'Chế độ nấu': 'Nấu cơm trắng, Cơm niêu, Nấu cháo, Làm bánh, Hầm xương, Nấu súp',
    'Hẹn giờ nấu': true,
  },
  49: { // Sharp 1.8 lít KS-COM194EV-BK
    'Dung tích': 1.8,
    'Loại nồi': 'Nồi cơm điện tử',
    'Công suất': 790,
    'Chất liệu lòng nồi': 'Hợp kim nhôm tráng men chống dính cao cấp',
    'Số người ăn': '4 - 6 người',
    'Chế độ nấu': 'Gạo lứt, Cơm trộn, Nấu cháo nhanh, Làm sữa chua, Hấp bánh bao',
    'Hẹn giờ nấu': true,
  },
  50: { // Kangaroo 1.2 lít KGR12IH1
    'Dung tích': 1.2,
    'Loại nồi': 'Nồi cơm cao tần (IH)',
    'Công suất': 1200,
    'Chất liệu lòng nồi': 'Hợp kim nhôm 7 lớp dạng niêu phủ men sứ chống dính',
    'Số người ăn': '2 - 4 người',
    'Chế độ nấu': 'Nấu cao tần hạt cơm chín dẻo từ trong ra ngoài, Giữ ấm 24 giờ',
    'Hẹn giờ nấu': true,
  },
  51: { // Nagakawa 1.2 lít NRC3812
    'Dung tích': 1.2,
    'Loại nồi': 'Nồi cơm nắp gài cơ',
    'Công suất': 500,
    'Chất liệu lòng nồi': 'Hợp kim nhôm chống dính Teflon',
    'Số người ăn': '2 - 4 người',
    'Chế độ nấu': 'Nấu cơm tiêu chuẩn và Hâm nóng tự động',
    'Hẹn giờ nấu': false,
  },
  52: { // Tefal 1.8 lít Delirice Plus RK776B68
    'Dung tích': 1.8,
    'Loại nồi': 'Nồi cơm điện tử lòng niêu',
    'Công suất': 750,
    'Chất liệu lòng nồi': 'Lòng nồi niêu hình cầu 4mm dày dặn phủ chống dính Ceramic',
    'Số người ăn': '4 - 6 người',
    'Chế độ nấu': '14 chương trình nấu tự động bao gồm cơm niêu giòn đáy, nấu chậm',
    'Hẹn giờ nấu': true,
  },
  53: { // Sunhouse 1.8 lít SHD8600DMX
    'Dung tích': 1.8,
    'Loại nồi': 'Nồi cơm nắp gài cơ',
    'Công suất': 700,
    'Chất liệu lòng nồi': 'Hợp kim nhôm phủ chống dính Whitford tiêu chuẩn Mỹ',
    'Số người ăn': '4 - 6 người',
    'Chế độ nấu': 'Nấu cơm và giữ ấm cơ bản, mâm nhiệt lớn truyền nhiệt nhanh',
    'Hẹn giờ nấu': false,
  },

  // NỒI CHIÊN KHÔNG DẦU
  61: { // Kangaroo 8 lít KGAF81MG
    'Dung tích': 8,
    'Công suất': 1800,
    'Nhiệt độ tối đa': 200,
    'Công nghệ chiên': 'Rapid Air đối lưu 360 độ giảm 85% dầu mỡ',
    'Bảng điều khiển': 'Cảm ứng điện tử hiển thị màn hình LED hiện đại',
    'Cửa kính quan sát': true,
    'Chất liệu lòng nồi': 'Kim loại phủ chống dính an toàn sức khỏe',
  },
  62: { // Sunhouse 9 lít SHD4035
    'Dung tích': 9,
    'Công suất': 1800,
    'Nhiệt độ tối đa': 200,
    'Công nghệ chiên': 'Khí nóng đối lưu công suất cao, chiên nướng nguyên con gà vịt',
    'Bảng điều khiển': 'Núm xoay cơ bền bỉ dễ sử dụng',
    'Cửa kính quan sát': true,
    'Chất liệu lòng nồi': 'Thép không gỉ phủ chống dính Whitford',
  },
  63: { // Tefal Window 6 lít EY821868
    'Dung tích': 6,
    'Công suất': 1700,
    'Nhiệt độ tối đa': 220,
    'Công nghệ chiên': 'Extra Crisp giòn rụm bên ngoài mọng nước bên trong',
    'Bảng điều khiển': 'Cảm ứng kỹ thuật số với 8 chế độ cài sẵn',
    'Cửa kính quan sát': true,
    'Chất liệu lòng nồi': 'Lòng nồi chống dính cao cấp tháo rời vệ sinh được bằng máy rửa chén',
  },
  64: { // Toshiba 7.4 lít AF-74CP1URVN(H)
    'Dung tích': 7.4,
    'Công suất': 1800,
    'Nhiệt độ tối đa': 200,
    'Công nghệ chiên': 'Heat-Q luồng nhiệt xoáy 3 chiều chín đều không cần lật',
    'Bảng điều khiển': 'Cảm ứng một chạm Smart Touch, 12 thực đơn phong phú',
    'Cửa kính quan sát': true,
    'Chất liệu lòng nồi': 'Hợp kim nhôm phủ ceramic chống trầy xước',
  },
  65: { // BlueStone 24 lít AFB-5895
    'Dung tích': 24,
    'Công suất': 2000,
    'Nhiệt độ tối đa': 230,
    'Công nghệ chiên': 'Kết hợp chiên không dầu và nướng hơi nước đối lưu Steam Air Fryer',
    'Bảng điều khiển': 'Cảm ứng điện tử màn hình LED',
    'Cửa kính quan sát': true,
    'Chất liệu lòng nồi': 'Khoang lò bằng thép không gỉ 304 cao cấp',
  },
}

async function run() {
  const pool = await getPool()
  console.log('--- 1. BẮT ĐẦU SEED CATEGORY ATTRIBUTES ---')

  for (const [catIdStr, attrs] of Object.entries(CATEGORY_ATTRIBUTES)) {
    const categoryId = Number(catIdStr)
    for (const attr of attrs) {
      const exists = await pool.request()
        .input('catId', sql.BigInt, categoryId)
        .input('name', sql.NVarChar(150), attr.name)
        .query('SELECT AttributeId FROM dbo.CategoryAttribute WHERE CategoryId = @catId AND AttributeName = @name')

      if (exists.recordset.length === 0) {
        await pool.request()
          .input('catId', sql.BigInt, categoryId)
          .input('name', sql.NVarChar(150), attr.name)
          .input('dataType', sql.VarChar(20), attr.dataType)
          .input('unit', sql.NVarChar(50), attr.unit ?? null)
          .input('isFilterable', sql.Bit, attr.filterable ? 1 : 0)
          .input('isSearchable', sql.Bit, attr.searchable ? 1 : 0)
          .query(`
            INSERT INTO dbo.CategoryAttribute (CategoryId, AttributeName, DataType, Unit, IsFilterable, IsSearchable)
            VALUES (@catId, @name, @dataType, @unit, @isFilterable, @isSearchable)
          `)
      }
    }
  }

  // Lấy bản đồ AttributeId theo CategoryId và AttributeName
  const allAttrsResult = await pool.request().query('SELECT AttributeId, CategoryId, AttributeName, DataType FROM dbo.CategoryAttribute')
  const attrMap = new Map<string, { attributeId: number; dataType: string }>()
  for (const row of allAttrsResult.recordset) {
    attrMap.set(`${row.CategoryId}__${row.AttributeName}`, {
      attributeId: Number(row.AttributeId),
      dataType: String(row.DataType),
    })
  }

  console.log(`Đã thiết lập ${allAttrsResult.recordset.length} thuộc tính danh mục.`)

  console.log('--- 2. BẮT ĐẦU SEED PRODUCT ATTRIBUTE VALUES CHO 47 SẢN PHẨM ---')

  // Xóa sạch thuộc tính cũ nếu có để seed mới chuẩn xác
  await pool.request().query('DELETE FROM dbo.ProductAttributeValue')

  let insertedCount = 0

  for (const [prodIdStr, specs] of Object.entries(PRODUCT_SPECS)) {
    const productId = Number(prodIdStr)

    // Lấy CategoryId của sản phẩm
    const pRow = await pool.request()
      .input('prodId', sql.BigInt, productId)
      .query('SELECT CategoryId FROM dbo.Product WHERE ProductId = @prodId')

    if (pRow.recordset.length === 0) continue
    const categoryId = Number(pRow.recordset[0].CategoryId)

    for (const [attrName, val] of Object.entries(specs)) {
      const key = `${categoryId}__${attrName}`
      const targetAttr = attrMap.get(key)
      if (!targetAttr) {
        console.warn(`Không tìm thấy thuộc tính [${attrName}] cho Category [${categoryId}]`)
        continue
      }

      let valText: string | null = null
      let valNumber: number | null = null
      let valBoolean: boolean | null = null

      if (targetAttr.dataType === 'Number') {
        valNumber = Number(val)
      } else if (targetAttr.dataType === 'Boolean') {
        valBoolean = Boolean(val)
      } else {
        valText = String(val)
      }

      await pool.request()
        .input('prodId', sql.BigInt, productId)
        .input('attrId', sql.BigInt, targetAttr.attributeId)
        .input('valText', sql.NVarChar(500), valText)
        .input('valNumber', sql.Decimal(18, 2), valNumber)
        .input('valBool', sql.Bit, valBoolean === null ? null : (valBoolean ? 1 : 0))
        .query(`
          INSERT INTO dbo.ProductAttributeValue (ProductId, AttributeId, ValueText, ValueNumber, ValueBoolean)
          VALUES (@prodId, @attrId, @valText, @valNumber, @valBool)
        `)

      insertedCount++
    }
  }

  console.log(`Đã thêm thành công ${insertedCount} giá trị thuộc tính chi tiết cho 47 sản phẩm!`)

  console.log('--- 3. RE-INDEX CATALOG LÊN VECTOR DATABASE QDRANT ---')
  const qdrantResult = await indexProductCatalog()
  console.log(`Đã đồng bộ thành công ${qdrantResult.indexedProducts} sản phẩm với vector embeddings lên Qdrant collection [${qdrantResult.collectionName}]!`)

  // Kiểm tra mẫu 1 sản phẩm
  const sampleCheck = await pool.request().query(`
    SELECT TOP (6)
      p.ProductName,
      ca.AttributeName,
      ca.Unit,
      COALESCE(
        pav.ValueText,
        CONVERT(NVARCHAR(100), pav.ValueNumber),
        CASE WHEN pav.ValueBoolean = 1 THEN N'Có' ELSE N'Không' END
      ) AS DisplayValue
    FROM dbo.ProductAttributeValue pav
    JOIN dbo.Product p ON p.ProductId = pav.ProductId
    JOIN dbo.CategoryAttribute ca ON ca.AttributeId = pav.AttributeId
    WHERE p.ProductId = 21
  `)
  console.log('Mẫu thông số Tivi TCL (ProductId 21):')
  console.table(sampleCheck.recordset)

  process.exit(0)
}

run().catch((err) => {
  console.error('Lỗi khi seed thuộc tính:', err)
  process.exit(1)
})
