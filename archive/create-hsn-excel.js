const XLSX = require('xlsx');

// Official HSN codes from CBIC GST website (cbic-gst.gov.in)
// Comprehensive list covering major categories
const hsnData = [
  // 5% GST Rate items - Food and Agricultural Products
  { code: '0202', description: 'Meat of bovine animals, frozen, pre-packaged and labelled', gstRate: 5 },
  { code: '0203', description: 'Meat of swine, frozen, pre-packaged and labelled', gstRate: 5 },
  { code: '0303', description: 'Fish, frozen, pre-packaged and labelled', gstRate: 5 },
  { code: '0401', description: 'Ultra High Temperature (UHT) milk', gstRate: 5 },
  { code: '0402', description: 'Milk and cream, concentrated, milk powder', gstRate: 5 },
  { code: '0403', description: 'Yoghurt, Cream, Curd, Lassi pre-packaged and labelled', gstRate: 5 },
  { code: '0406', description: 'Cheese, Paneer, Chena pre-packaged and labelled', gstRate: 5 },
  { code: '0409', description: 'Natural honey pre-packaged and labelled', gstRate: 5 },
  { code: '0713', description: 'Dried leguminous vegetables, pulses', gstRate: 5 },
  { code: '0801', description: 'Coconuts, Brazil nuts, dried', gstRate: 5 },
  { code: '0802', description: 'Nuts - Almonds, Walnuts, Cashews, dried', gstRate: 5 },
  { code: '0806', description: 'Grapes, dried, and raisins', gstRate: 5 },
  { code: '0901', description: 'Coffee roasted', gstRate: 5 },
  { code: '0902', description: 'Tea, whether or not flavoured', gstRate: 5 },
  { code: '0904', description: 'Pepper, Chilli, dried or crushed', gstRate: 5 },
  { code: '0906', description: 'Cinnamon and cinnamon-tree flowers', gstRate: 5 },
  { code: '0907', description: 'Cloves', gstRate: 5 },
  { code: '0908', description: 'Nutmeg, mace and cardamoms', gstRate: 5 },
  { code: '0910', description: 'Ginger, Turmeric, Saffron, other spices', gstRate: 5 },
  { code: '1001', description: 'Wheat and meslin pre-packaged and labelled', gstRate: 5 },
  { code: '1005', description: 'Maize (corn) pre-packaged and labelled', gstRate: 5 },
  { code: '1006', description: 'Rice pre-packaged and labelled', gstRate: 5 },
  { code: '1101', description: 'Wheat or meslin flour pre-packaged and labelled', gstRate: 5 },
  { code: '1201', description: 'Soya beans', gstRate: 5 },
  { code: '1202', description: 'Ground-nuts, not roasted', gstRate: 5 },
  { code: '1507', description: 'Soya-bean oil', gstRate: 5 },
  { code: '1508', description: 'Ground-nut oil', gstRate: 5 },
  { code: '1509', description: 'Olive oil', gstRate: 5 },
  { code: '1511', description: 'Palm oil', gstRate: 5 },
  { code: '1512', description: 'Sunflower-seed, safflower or cotton-seed oil', gstRate: 5 },
  { code: '1513', description: 'Coconut oil', gstRate: 5 },
  { code: '1514', description: 'Rape, colza or mustard oil', gstRate: 5 },
  { code: '1701', description: 'Jaggery, Khandsari Sugar pre-packaged and labelled', gstRate: 5 },
  { code: '1801', description: 'Cocoa beans whole or broken, raw or roasted', gstRate: 5 },
  { code: '1902', description: 'Seviyan (vermicelli)', gstRate: 5 },
  { code: '1905', description: 'Pizza bread, Khakhra, Plain chapatti or roti', gstRate: 5 },
  { code: '2106', description: 'Roasted Gram, idli/dosa batter', gstRate: 5 },
  { code: '2302', description: 'Bran, rice bran', gstRate: 5 },
  { code: '4901', description: 'Brochures, leaflets printed matter', gstRate: 5 },
  { code: '5201', description: 'Cotton, not carded or combed', gstRate: 5 },
  { code: '5305', description: 'Jute, flax, other textile fibres', gstRate: 5 },
  
  // 12% GST Rate items
  { code: '0405', description: 'Butter, Ghee and other fats from milk', gstRate: 12 },
  { code: '1517', description: 'Margarine, edible mixtures of fats', gstRate: 12 },
  { code: '1704', description: 'Sugar boiled confectionery', gstRate: 12 },
  { code: '2009', description: 'Tender coconut water pre-packaged', gstRate: 12 },
  { code: '2101', description: 'Coffee/tea extracts, essences', gstRate: 12 },
  { code: '2102', description: 'Yeasts, baking powders', gstRate: 12 },
  { code: '2103', description: 'Sauces, mustard, curry paste', gstRate: 12 },
  { code: '3004', description: 'Medicaments (Ayurvedic, Unani, Homeopathic)', gstRate: 12 },
  { code: '3006', description: 'Medical supplies, ostomy appliances', gstRate: 12 },
  { code: '3101', description: 'Fertilisers, animal/vegetable', gstRate: 12 },
  { code: '3304', description: 'Beauty preparations (excluding Kajal)', gstRate: 12 },
  { code: '3305', description: 'Hair preparations', gstRate: 12 },
  { code: '3306', description: 'Toothpaste, dental hygiene (excluding powder)', gstRate: 12 },
  { code: '3307', description: 'Agarbatti, dhoop, perfumery preparations', gstRate: 12 },
  { code: '3401', description: 'Soap and organic surface-active products', gstRate: 12 },
  { code: '3402', description: 'Washing and cleaning preparations', gstRate: 12 },
  { code: '3926', description: 'Feeding bottles and other plastic articles', gstRate: 12 },
  { code: '4016', description: 'Rubber bands, other rubber articles', gstRate: 12 },
  { code: '4202', description: 'Handbags, pouches, purses', gstRate: 12 },
  { code: '4802', description: 'Uncoated paper for writing/printing', gstRate: 12 },
  { code: '4818', description: 'Toilet paper, tissues, napkins', gstRate: 12 },
  { code: '4820', description: 'Exercise books, notebooks', gstRate: 12 },
  { code: '4823', description: 'Paper pulp moulded trays', gstRate: 12 },
  { code: '5401', description: 'Sewing thread of man-made filaments', gstRate: 12 },
  { code: '5508', description: 'Sewing thread of man-made staple fibres', gstRate: 12 },
  { code: '5701', description: 'Carpets and textile floor coverings', gstRate: 12 },
  { code: '6109', description: 'T-shirts, singlets, vests, knitted (sale value ≤Rs.1000)', gstRate: 12 },
  { code: '6110', description: 'Jerseys, pullovers, cardigans, knitted', gstRate: 12 },
  { code: '6203', description: 'Men suits, jackets, trousers (sale value ≤Rs.1000)', gstRate: 12 },
  { code: '6204', description: 'Women suits, dresses, skirts (sale value ≤Rs.1000)', gstRate: 12 },
  { code: '6211', description: 'Track suits, ski suits, swimwear', gstRate: 12 },
  { code: '6212', description: 'Brassieres, girdles, corsets', gstRate: 12 },
  { code: '6214', description: 'Shawls, scarves, mufflers, veils', gstRate: 12 },
  { code: '6215', description: 'Ties, bow ties', gstRate: 12 },
  { code: '6302', description: 'Bed linen, table linen, towels', gstRate: 12 },
  { code: '6401', description: 'Waterproof footwear', gstRate: 12 },
  { code: '6404', description: 'Footwear with textile uppers', gstRate: 12 },
  { code: '6815', description: 'Stone or marble articles', gstRate: 12 },
  { code: '6905', description: 'Earthen or roofing tiles', gstRate: 12 },
  { code: '7020', description: 'Glass chimneys for lamps', gstRate: 12 },
  { code: '7323', description: 'Table, kitchen articles of iron or steel', gstRate: 12 },
  { code: '7615', description: 'Aluminium utensils and articles', gstRate: 12 },
  { code: '8201', description: 'Hand tools for agriculture', gstRate: 12 },
  { code: '8214', description: 'Pencil sharpeners', gstRate: 12 },
  { code: '8413', description: 'Hand pumps and parts', gstRate: 12 },
  { code: '8423', description: 'Weighing machinery', gstRate: 12 },
  { code: '8701', description: 'Tractors (engine capacity ≤1800cc)', gstRate: 12 },
  { code: '9403', description: 'Furniture of bamboo, rattan, cane', gstRate: 12 },
  { code: '9404', description: 'Cotton quilts (sale value ≤Rs.1000)', gstRate: 12 },
  { code: '9608', description: 'Pens, pencils, crayons', gstRate: 12 },
  { code: '9609', description: 'Pencils, pastels, drawing charcoals', gstRate: 12 },
  
  // 18% GST Rate items
  { code: '1702', description: 'Sugars (lactose, maltose, glucose, fructose)', gstRate: 18 },
  { code: '1806', description: 'Chocolates and cocoa preparations', gstRate: 18 },
  { code: '1904', description: 'Corn flakes, cereal preparations', gstRate: 18 },
  { code: '2104', description: 'Soups and broths', gstRate: 18 },
  { code: '2105', description: 'Ice cream and edible ice', gstRate: 18 },
  { code: '2201', description: 'Waters, mineral waters, aerated waters (20L bottles)', gstRate: 18 },
  { code: '2202', description: 'Non-alcoholic beverages (excluding tender coconut)', gstRate: 18 },
  { code: '2523', description: 'Portland cement and similar hydraulic cements', gstRate: 18 },
  { code: '2707', description: 'Oils from coal tar distillation', gstRate: 18 },
  { code: '2710', description: 'Petroleum oils (excluding LPG domestic)', gstRate: 18 },
  { code: '3003', description: 'Medicaments (two or more constituents)', gstRate: 18 },
  { code: '3005', description: 'Wadding, gauze, bandages', gstRate: 18 },
  { code: '3213', description: 'Artists colours, paints', gstRate: 18 },
  { code: '3303', description: 'Perfumes and toilet waters', gstRate: 18 },
  { code: '3602', description: 'Prepared explosives', gstRate: 18 },
  { code: '3604', description: 'Fireworks', gstRate: 18 },
  { code: '3901', description: 'Polymers of ethylene, in primary forms', gstRate: 18 },
  { code: '3902', description: 'Polymers of propylene, in primary forms', gstRate: 18 },
  { code: '3903', description: 'Polymers of styrene, in primary forms', gstRate: 18 },
  { code: '3916', description: 'Monofilament, rods, sticks of plastics', gstRate: 18 },
  { code: '3917', description: 'Tubes, pipes and fittings of plastics', gstRate: 18 },
  { code: '3918', description: 'Floor coverings of plastics', gstRate: 18 },
  { code: '3919', description: 'Self-adhesive plates, sheets of plastics', gstRate: 18 },
  { code: '3920', description: 'Plates, sheets, film, foil of plastics', gstRate: 18 },
  { code: '3921', description: 'Cellular plates, sheets of plastics', gstRate: 18 },
  { code: '3922', description: 'Baths, shower-baths, wash-basins of plastics', gstRate: 18 },
  { code: '3923', description: 'Articles for packing goods, of plastics', gstRate: 18 },
  { code: '3924', description: 'Tableware, kitchenware of plastics', gstRate: 18 },
  { code: '3925', description: 'Builders ware of plastics', gstRate: 18 },
  { code: '4001', description: 'Natural rubber, balata, gutta-percha', gstRate: 18 },
  { code: '4011', description: 'New pneumatic tyres, of rubber', gstRate: 18 },
  { code: '4811', description: 'Paper, paperboard, coated, impregnated', gstRate: 18 },
  { code: '4819', description: 'Cartons, boxes, bags of paper', gstRate: 18 },
  { code: '5402', description: 'Synthetic filament yarn', gstRate: 18 },
  { code: '5509', description: 'Yarn of synthetic staple fibres', gstRate: 18 },
  { code: '5702', description: 'Carpets, woven, not tufted', gstRate: 18 },
  { code: '6402', description: 'Footwear with rubber/plastic outer soles', gstRate: 18 },
  { code: '6403', description: 'Footwear with leather outer soles', gstRate: 18 },
  { code: '6405', description: 'Other footwear', gstRate: 18 },
  { code: '6802', description: 'Worked monumental or building stone', gstRate: 18 },
  { code: '6810', description: 'Articles of cement, concrete, artificial stone', gstRate: 18 },
  { code: '6901', description: 'Bricks, blocks, tiles of ceramic', gstRate: 18 },
  { code: '6907', description: 'Ceramic flags and paving', gstRate: 18 },
  { code: '6912', description: 'Ceramic tableware, kitchenware', gstRate: 18 },
  { code: '7013', description: 'Glassware for table, kitchen, toilet', gstRate: 18 },
  { code: '7308', description: 'Structures of iron or steel', gstRate: 18 },
  { code: '7309', description: 'Reservoirs, tanks of iron or steel', gstRate: 18 },
  { code: '7310', description: 'Tanks, cans, drums of iron or steel', gstRate: 18 },
  { code: '7324', description: 'Sanitary ware of iron or steel', gstRate: 18 },
  { code: '7326', description: 'Other articles of iron or steel', gstRate: 18 },
  { code: '7601', description: 'Unwrought aluminium', gstRate: 18 },
  { code: '7612', description: 'Aluminium casks, drums, cans', gstRate: 18 },
  { code: '8414', description: 'Air pumps, fans, hoods', gstRate: 18 },
  { code: '8415', description: 'Air conditioning machines', gstRate: 18 },
  { code: '8418', description: 'Refrigerators, freezers', gstRate: 18 },
  { code: '8421', description: 'Water filtering/purifying machinery', gstRate: 18 },
  { code: '8443', description: 'Printing machinery', gstRate: 18 },
  { code: '8450', description: 'Washing machines', gstRate: 18 },
  { code: '8471', description: 'Computers and data processing machines', gstRate: 18 },
  { code: '8504', description: 'Electrical transformers, chargers', gstRate: 18 },
  { code: '8516', description: 'Electric heaters, irons, hair dryers', gstRate: 18 },
  { code: '8517', description: 'Telephone sets, mobile phones', gstRate: 18 },
  { code: '8519', description: 'Sound recording/reproducing apparatus', gstRate: 18 },
  { code: '8528', description: 'Monitors, projectors, TVs', gstRate: 18 },
  { code: '8536', description: 'Electrical switches, plugs, sockets', gstRate: 18 },
  { code: '8539', description: 'Electric lamps and light fittings', gstRate: 18 },
  { code: '8703', description: 'Motor cars (petrol ≤1200cc, diesel ≤1500cc)', gstRate: 18 },
  { code: '8711', description: 'Motorcycles (engine capacity ≤350cc)', gstRate: 18 },
  { code: '9001', description: 'Optical fibres, lenses', gstRate: 18 },
  { code: '9004', description: 'Spectacles, goggles', gstRate: 18 },
  { code: '9018', description: 'Medical, surgical, dental instruments', gstRate: 18 },
  { code: '9401', description: 'Seats and parts thereof', gstRate: 18 },
  { code: '9405', description: 'Lamps and lighting fittings', gstRate: 18 },
  { code: '9504', description: 'Video game consoles, toys', gstRate: 18 },
  { code: '9506', description: 'Sports equipment', gstRate: 18 },
  { code: '9603', description: 'Brooms, brushes, mops', gstRate: 18 },
  
  // 28% GST Rate items
  { code: '2202', description: 'Aerated waters, lemonade, caffeinated beverages', gstRate: 28 },
  { code: '8509', description: 'Vacuum cleaners', gstRate: 28 },
  { code: '9503', description: 'Electronic toys', gstRate: 28 },
];

console.log('Creating HSN Codes Excel Template...');
console.log(`Total HSN codes: ${hsnData.length}`);

// Create worksheet data with headers
const worksheetData = [
  ['HSN Code', 'Description', 'GST Rate (%)'], // Header row
  ...hsnData.map(item => [item.code, item.description, item.gstRate])
];

// Create a new workbook
const workbook = XLSX.utils.book_new();

// Create worksheet from data
const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

// Set column widths
worksheet['!cols'] = [
  { wch: 12 }, // HSN Code column
  { wch: 80 }, // Description column
  { wch: 15 }  // GST Rate column
];

// Add worksheet to workbook
XLSX.utils.book_append_sheet(workbook, worksheet, 'HSN Codes');

// Write to file
const outputPath = './hsn-codes-template.xlsx';
XLSX.writeFile(workbook, outputPath);

console.log(`✓ Excel file created successfully: ${outputPath}`);
console.log(`✓ Total entries: ${hsnData.length}`);
console.log('\nGST Rate Distribution:');
console.log(`  - 5%:  ${hsnData.filter(h => h.gstRate === 5).length} items`);
console.log(`  - 12%: ${hsnData.filter(h => h.gstRate === 12).length} items`);
console.log(`  - 18%: ${hsnData.filter(h => h.gstRate === 18).length} items`);
console.log(`  - 28%: ${hsnData.filter(h => h.gstRate === 28).length} items`);
console.log('\nYou can now import this file from the Admin HSN Codes page.');
