import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import * as https from 'https';
import * as http from 'http';
import { HsnCode } from './hsn-code.entity';

export interface CreateHsnCodeDto {
  code: string;
  description: string;
  gstRate: number;
  category?: string;
}

export interface UpdateHsnCodeDto {
  description?: string;
  gstRate?: number;
  category?: string;
}

@Injectable()
export class HsnCodesService {
  constructor(
    @InjectRepository(HsnCode)
    private hsnCodeRepository: Repository<HsnCode>,
  ) {}

  async findAll(): Promise<HsnCode[]> {
    return await this.hsnCodeRepository.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
  }

  async findByCode(code: string): Promise<HsnCode | null> {
    return await this.hsnCodeRepository.findOne({
      where: { code, isActive: true },
    });
  }

  async create(data: CreateHsnCodeDto): Promise<HsnCode> {
    const hsnCode = this.hsnCodeRepository.create({
      code: data.code,
      description: data.description,
      recommendedGstRate: data.gstRate,
      category: data.category,
      isActive: true,
    });
    return await this.hsnCodeRepository.save(hsnCode);
  }

  async update(id: string, data: UpdateHsnCodeDto): Promise<HsnCode> {
    const hsnCode = await this.hsnCodeRepository.findOne({ where: { id } });
    if (!hsnCode) {
      throw new Error('HSN code not found');
    }

    if (data.description !== undefined) {
      hsnCode.description = data.description;
    }
    if (data.gstRate !== undefined) {
      hsnCode.recommendedGstRate = data.gstRate;
    }
    if (data.category !== undefined) {
      hsnCode.category = data.category;
    }

    return await this.hsnCodeRepository.save(hsnCode);
  }

  async delete(id: string): Promise<void> {
    await this.hsnCodeRepository.delete(id);
  }

  async seedStandardCodes(): Promise<{ created: number; skipped: number }> {
    const standardCodes: CreateHsnCodeDto[] = [
      // ── Live animals & meat ──────────────────────────────────────────────────
      { code: '0101', description: 'Live horses, asses, mules and hinnies', gstRate: 0 },
      { code: '0201', description: 'Meat of bovine animals, fresh or chilled', gstRate: 0 },
      { code: '0207', description: 'Meat and edible offal of poultry, fresh, chilled or frozen', gstRate: 0 },
      // ── Fish & seafood ───────────────────────────────────────────────────────
      { code: '0301', description: 'Live fish', gstRate: 0 },
      { code: '0302', description: 'Fish, fresh or chilled', gstRate: 0 },
      { code: '0303', description: 'Fish, frozen', gstRate: 5 },
      { code: '0306', description: 'Crustaceans; lobsters, crabs, shrimps', gstRate: 5 },
      // ── Dairy & eggs ────────────────────────────────────────────────────────
      { code: '0401', description: 'Milk and cream, not concentrated or sweetened', gstRate: 0 },
      { code: '0402', description: 'Milk and cream, concentrated or sweetened', gstRate: 5 },
      { code: '0403', description: 'Yogurt, buttermilk, curd', gstRate: 5 },
      { code: '0405', description: 'Butter and other fats and oils derived from milk', gstRate: 12 },
      { code: '0406', description: 'Cheese and curd', gstRate: 12 },
      { code: '0407', description: 'Birds\' eggs, in shell, fresh, preserved or cooked', gstRate: 0 },
      // ── Honey & edible products ──────────────────────────────────────────────
      { code: '0409', description: 'Natural honey', gstRate: 5 },
      // ── Cereals ──────────────────────────────────────────────────────────────
      { code: '1001', description: 'Wheat and meslin', gstRate: 0 },
      { code: '1002', description: 'Rye', gstRate: 0 },
      { code: '1006', description: 'Rice', gstRate: 5 },
      { code: '1101', description: 'Wheat or meslin flour', gstRate: 0 },
      { code: '1102', description: 'Cereal flours other than of wheat or meslin', gstRate: 0 },
      { code: '1108', description: 'Starches; inulin', gstRate: 18 },
      // ── Edible vegetables ────────────────────────────────────────────────────
      { code: '0701', description: 'Potatoes, fresh or chilled', gstRate: 0 },
      { code: '0702', description: 'Tomatoes, fresh or chilled', gstRate: 0 },
      { code: '0703', description: 'Onions, shallots, garlic, leeks', gstRate: 0 },
      { code: '0714', description: 'Manioc, arrowroot, sweet potatoes', gstRate: 0 },
      // ── Edible fruits & nuts ─────────────────────────────────────────────────
      { code: '0801', description: 'Coconuts, Brazil nuts and cashew nuts', gstRate: 5 },
      { code: '0802', description: 'Other nuts — almonds, hazelnuts, pistachios', gstRate: 5 },
      { code: '0804', description: 'Dates, figs, pineapples, avocados, guavas, mangoes', gstRate: 0 },
      { code: '0806', description: 'Grapes, fresh or dried', gstRate: 0 },
      { code: '0808', description: 'Apples, pears and quinces, fresh', gstRate: 0 },
      // ── Oil seeds & spices ───────────────────────────────────────────────────
      { code: '0901', description: 'Coffee, whether or not roasted', gstRate: 5 },
      { code: '0902', description: 'Tea, whether or not flavoured', gstRate: 5 },
      { code: '0904', description: 'Pepper; chilli peppers', gstRate: 5 },
      { code: '0907', description: 'Cloves (whole fruit, cloves and stems)', gstRate: 5 },
      { code: '0910', description: 'Ginger, saffron, turmeric, thyme, bay leaves, curry', gstRate: 5 },
      { code: '1501', description: 'Lard; other pig fat; poultry fat', gstRate: 0 },
      { code: '1507', description: 'Soya-bean oil and its fractions', gstRate: 5 },
      { code: '1511', description: 'Palm oil and its fractions', gstRate: 5 },
      { code: '1512', description: 'Sunflower-seed, safflower or cotton-seed oil', gstRate: 5 },
      { code: '1514', description: 'Rapeseed, colza or mustard oil', gstRate: 5 },
      // ── Sugar & confectionery ────────────────────────────────────────────────
      { code: '1701', description: 'Cane or beet sugar and chemically pure sucrose', gstRate: 5 },
      { code: '1703', description: 'Molasses resulting from the extraction of sugar', gstRate: 28 },
      { code: '1704', description: 'Sugar confectionery not containing cocoa', gstRate: 18 },
      { code: '1803', description: 'Cocoa paste, whether or not defatted', gstRate: 18 },
      { code: '1806', description: 'Chocolate and other food preparations containing cocoa', gstRate: 18 },
      // ── Prepared food ─────────────────────────────────────────────────────────
      { code: '1901', description: 'Malt extract; food preparations of flour, starch', gstRate: 18 },
      { code: '1902', description: 'Pasta, cooked or not cooked, stuffed', gstRate: 12 },
      { code: '1904', description: 'Breakfast cereals — cornflakes', gstRate: 18 },
      { code: '1905', description: 'Bread, pastry, cakes, biscuits and other bakers\' wares', gstRate: 18 },
      { code: '2001', description: 'Vegetables prepared or preserved by vinegar', gstRate: 12 },
      { code: '2009', description: 'Fruit juices and vegetable juices, unfermented', gstRate: 12 },
      { code: '2101', description: 'Extracts, essences of coffee, tea or maté; roasted chicory', gstRate: 12 },
      { code: '2103', description: 'Sauces and preparations therefor; mixed condiments', gstRate: 12 },
      { code: '2105', description: 'Ice cream and other edible ice, whether or not containing cocoa', gstRate: 18 },
      { code: '2106', description: 'Food preparations not elsewhere specified', gstRate: 18 },
      // ── Beverages ────────────────────────────────────────────────────────────
      { code: '2201', description: 'Waters, natural or artificial mineral waters, aerated waters', gstRate: 18 },
      { code: '2202', description: 'Carbonated soft drinks and flavoured water', gstRate: 28 },
      { code: '2203', description: 'Beer made from malt', gstRate: 28 },
      { code: '2204', description: 'Wine of fresh grapes', gstRate: 0 },
      { code: '2208', description: 'Undenatured ethyl alcohol; spirits, liqueurs', gstRate: 0 },
      // ── Tobacco ───────────────────────────────────────────────────────────────
      { code: '2401', description: 'Unmanufactured tobacco; tobacco refuse', gstRate: 28 },
      { code: '2402', description: 'Cigars, cheroots, cigarettes, of tobacco', gstRate: 28 },
      // ── Chemicals ─────────────────────────────────────────────────────────────
      { code: '2701', description: 'Coal; briquettes, ovoids and similar solid fuels from coal', gstRate: 5 },
      { code: '2710', description: 'Petroleum oils and oils from bituminous minerals', gstRate: 18 },
      { code: '2711', description: 'Petroleum gas and other gaseous hydrocarbons', gstRate: 5 },
      { code: '2814', description: 'Ammonia, anhydrous or in aqueous solution', gstRate: 18 },
      { code: '2833', description: 'Sulphates; alums; peroxosulphates', gstRate: 18 },
      { code: '2916', description: 'Unsaturated acyclic monocarboxylic acids', gstRate: 18 },
      // ── Plastics ──────────────────────────────────────────────────────────────
      { code: '3901', description: 'Polymers of ethylene, in primary forms', gstRate: 18 },
      { code: '3902', description: 'Polymers of propylene, in primary forms', gstRate: 18 },
      { code: '3924', description: 'Tableware, kitchenware and other household articles of plastics', gstRate: 18 },
      { code: '3926', description: 'Other articles of plastics', gstRate: 18 },
      // ── Rubber ────────────────────────────────────────────────────────────────
      { code: '4011', description: 'New pneumatic tyres, of rubber', gstRate: 28 },
      { code: '4016', description: 'Other articles of vulcanised rubber other than hard rubber', gstRate: 18 },
      // ── Leather & leather goods ───────────────────────────────────────────────
      { code: '4107', description: 'Leather further prepared after tanning or crusting', gstRate: 12 },
      { code: '4202', description: 'Trunks, suit-cases, vanity-cases, handbags, wallets', gstRate: 18 },
      { code: '4203', description: 'Articles of apparel and clothing accessories, of leather', gstRate: 18 },
      // ── Paper & printed items ─────────────────────────────────────────────────
      { code: '4802', description: 'Uncoated paper and paperboard', gstRate: 12 },
      { code: '4820', description: 'Registers, account books, notebooks, diaries, planners', gstRate: 12 },
      { code: '4901', description: 'Printed books, brochures, leaflets', gstRate: 0 },
      { code: '4902', description: 'Newspapers, journals and periodicals', gstRate: 0 },
      { code: '4911', description: 'Other printed matter, including printed pictures', gstRate: 12 },
      // ── Textiles ──────────────────────────────────────────────────────────────
      { code: '5004', description: 'Silk yarn (not spun from silk waste)', gstRate: 5 },
      { code: '5007', description: 'Woven fabrics of silk or silk waste', gstRate: 5 },
      { code: '5205', description: 'Cotton yarn other than sewing thread', gstRate: 5 },
      { code: '5208', description: 'Woven fabrics of cotton, <85%, weight ≤200g/m²', gstRate: 5 },
      { code: '5407', description: 'Woven fabrics of synthetic filament yarn', gstRate: 12 },
      { code: '5512', description: 'Woven fabrics of synthetic staple fibres, ≥85%', gstRate: 12 },
      // ── Garments ──────────────────────────────────────────────────────────────
      { code: '6101', description: 'Men\'s or boys\' overcoats, of wool or fine animal hair', gstRate: 12 },
      { code: '6102', description: 'Women\'s or girls\' overcoats, of wool or fine animal hair', gstRate: 12 },
      { code: '6103', description: 'Men\'s or boys\' suits, ensembles, jackets', gstRate: 12 },
      { code: '6104', description: 'Women\'s or girls\' suits, ensembles, jackets, dresses', gstRate: 12 },
      { code: '6105', description: 'Men\'s or boys\' shirts, of knitted fabric', gstRate: 12 },
      { code: '6106', description: 'Women\'s or girls\' blouses, shirts, of knitted fabric', gstRate: 12 },
      { code: '6107', description: 'Men\'s or boys\' underpants, pyjamas and similar, knitted', gstRate: 12 },
      { code: '6108', description: 'Women\'s or girls\' slips, pyjamas, negligees, knitted', gstRate: 12 },
      { code: '6109', description: 'T-shirts, singlets and other vests, of knitted fabric', gstRate: 12 },
      { code: '6110', description: 'Jerseys, pullovers, sweatshirts, waistcoats of knitted fabric', gstRate: 12 },
      { code: '6111', description: 'Babies\' garments and accessories of knitted fabric', gstRate: 5 },
      { code: '6203', description: 'Men\'s or boys\' suits, jackets, trousers, bib and brace', gstRate: 12 },
      { code: '6204', description: 'Women\'s or girls\' suits, jackets, dresses, skirts', gstRate: 12 },
      { code: '6205', description: 'Men\'s or boys\' shirts', gstRate: 12 },
      { code: '6206', description: 'Women\'s or girls\' blouses and shirts', gstRate: 12 },
      { code: '6207', description: 'Men\'s or boys\' underpants, pyjamas, bathrobes', gstRate: 12 },
      { code: '6208', description: 'Women\'s or girls\' slips, pyjamas, bathrobes, dressing gowns', gstRate: 12 },
      { code: '6209', description: 'Babies\' garments and clothing accessories', gstRate: 5 },
      { code: '6210', description: 'Garments of felt or non-woven fabrics', gstRate: 12 },
      { code: '6211', description: 'Track suits, ski suits and swimwear', gstRate: 12 },
      { code: '6213', description: 'Handkerchiefs', gstRate: 12 },
      { code: '6214', description: 'Shawls, scarves, mufflers, mantillas, veils', gstRate: 12 },
      { code: '6215', description: 'Ties, bow ties and cravats', gstRate: 12 },
      { code: '6216', description: 'Gloves, mittens and mitts', gstRate: 12 },
      { code: '6217', description: 'Other made-up clothing accessories', gstRate: 12 },
      // ── Footwear ──────────────────────────────────────────────────────────────
      { code: '6401', description: 'Waterproof footwear with outer soles and uppers of rubber', gstRate: 18 },
      { code: '6402', description: 'Other footwear with outer soles and uppers of rubber', gstRate: 18 },
      { code: '6403', description: 'Footwear with outer soles of rubber and uppers of leather', gstRate: 18 },
      { code: '6404', description: 'Footwear with outer soles of rubber and uppers of textile', gstRate: 18 },
      { code: '6405', description: 'Other footwear', gstRate: 18 },
      // ── Headgear ──────────────────────────────────────────────────────────────
      { code: '6501', description: 'Hat-forms, hat bodies; plateaux and manchons, of felt', gstRate: 12 },
      { code: '6505', description: 'Hats and headgear, knitted; hair-nets', gstRate: 12 },
      // ── Umbrellas & accessories ───────────────────────────────────────────────
      { code: '6601', description: 'Umbrellas and sun umbrellas', gstRate: 12 },
      { code: '6602', description: 'Walking-sticks, seat-sticks, whips, riding-crops', gstRate: 12 },
      // ── Stone, plaster, ceramics, glass ──────────────────────────────────────
      { code: '6802', description: 'Worked monumental or building stone', gstRate: 18 },
      { code: '6911', description: 'Tableware, kitchenware and other household articles of porcelain', gstRate: 18 },
      { code: '7013', description: 'Glassware for table, kitchen, toilet, office, indoor decoration', gstRate: 18 },
      // ── Precious metals & jewellery ───────────────────────────────────────────
      { code: '7106', description: 'Silver (including silver plated with gold), unwrought', gstRate: 3 },
      { code: '7108', description: 'Gold (including gold plated with platinum), unwrought', gstRate: 3 },
      { code: '7113', description: 'Articles of jewellery of precious metal', gstRate: 3 },
      { code: '7114', description: 'Articles of goldsmiths\' wares of precious metal', gstRate: 3 },
      { code: '7117', description: 'Imitation jewellery', gstRate: 3 },
      // ── Iron & steel ──────────────────────────────────────────────────────────
      { code: '7208', description: 'Flat-rolled products of iron or non-alloy steel', gstRate: 18 },
      { code: '7216', description: 'Angles, shapes and sections of iron or non-alloy steel', gstRate: 18 },
      // ── Copper, aluminium ─────────────────────────────────────────────────────
      { code: '7407', description: 'Copper bars, rods and profiles', gstRate: 18 },
      { code: '7610', description: 'Aluminium structures excluding prefabricated buildings', gstRate: 18 },
      // ── Tools & hardware ──────────────────────────────────────────────────────
      { code: '8201', description: 'Hand tools: spades, shovels, mattocks, picks, hoes', gstRate: 12 },
      { code: '8203', description: 'Files, rasps, pliers, pincers, tweezers, metal cutting shears', gstRate: 18 },
      { code: '8205', description: 'Hand tools not elsewhere specified; blow lamps; vices', gstRate: 18 },
      { code: '8207', description: 'Interchangeable tools for hand tools, machine tools', gstRate: 18 },
      // ── Boilers & machinery ───────────────────────────────────────────────────
      { code: '8415', description: 'Air conditioning machines', gstRate: 28 },
      { code: '8418', description: 'Refrigerators, freezers and other refrigerating equipment', gstRate: 18 },
      { code: '8421', description: 'Centrifuges; filtering or purifying machines for liquids/gases', gstRate: 18 },
      { code: '8422', description: 'Dish washing machines; machinery for cleaning or drying bottles', gstRate: 18 },
      { code: '8450', description: 'Household type washing machines', gstRate: 18 },
      { code: '8451', description: 'Machinery for washing, cleaning, wringing, drying textile', gstRate: 18 },
      { code: '8473', description: 'Parts and accessories for machines of headings 8469-8472', gstRate: 18 },
      { code: '8479', description: 'Machines not elsewhere specified having individual functions', gstRate: 18 },
      // ── Electronics & electrical ──────────────────────────────────────────────
      { code: '8501', description: 'Electric motors and generators', gstRate: 18 },
      { code: '8502', description: 'Electric generating sets and rotary converters', gstRate: 18 },
      { code: '8504', description: 'Electrical transformers, static converters (e.g., rectifiers)', gstRate: 18 },
      { code: '8507', description: 'Electric accumulators, including separators therefor', gstRate: 18 },
      { code: '8508', description: 'Vacuum cleaners', gstRate: 28 },
      { code: '8509', description: 'Household electromechanical appliances with self-contained motor', gstRate: 28 },
      { code: '8510', description: 'Shavers, hair clippers and hair-removing appliances', gstRate: 28 },
      { code: '8513', description: 'Portable electric lamps', gstRate: 18 },
      { code: '8516', description: 'Electric water heaters, hair dryers, electric smoothing irons', gstRate: 28 },
      { code: '8517', description: 'Telephone sets including smartphones and mobile phones', gstRate: 18 },
      { code: '8518', description: 'Microphones, loudspeakers, headphones, amplifiers', gstRate: 18 },
      { code: '8519', description: 'Sound recording or reproducing apparatus', gstRate: 18 },
      { code: '8523', description: 'Discs, tapes, solid-state non-volatile storage devices', gstRate: 18 },
      { code: '8525', description: 'Transmission apparatus for radio-broadcasting or TV; cameras', gstRate: 18 },
      { code: '8527', description: 'Reception apparatus for radio-broadcasting', gstRate: 18 },
      { code: '8528', description: 'Monitors and projectors; reception apparatus for TV', gstRate: 28 },
      { code: '8534', description: 'Printed circuits', gstRate: 18 },
      { code: '8536', description: 'Electrical apparatus for switching, protecting electrical circuits', gstRate: 18 },
      { code: '8544', description: 'Insulated wire, cable; optical fibre cables', gstRate: 18 },
      // ── Computers ─────────────────────────────────────────────────────────────
      { code: '8471', description: 'Automatic data processing machines (computers, laptops, tablets)', gstRate: 18 },
      { code: '8443', description: 'Printing machinery; other printers, copying machines, fax', gstRate: 18 },
      // ── Cameras & optical ─────────────────────────────────────────────────────
      { code: '9006', description: 'Photographic cameras other than cinematographic', gstRate: 18 },
      { code: '9013', description: 'Lasers other than laser diodes; other optical appliances', gstRate: 18 },
      // ── Watches & clocks ──────────────────────────────────────────────────────
      { code: '9101', description: 'Wrist-watches, pocket-watches with precious metal case', gstRate: 18 },
      { code: '9102', description: 'Wrist-watches, pocket-watches other', gstRate: 18 },
      { code: '9105', description: 'Other clocks', gstRate: 18 },
      // ── Musical instruments ───────────────────────────────────────────────────
      { code: '9201', description: 'Pianos, including automatic pianos; harpsichords', gstRate: 12 },
      { code: '9207', description: 'Musical instruments whose sound is produced electrically', gstRate: 12 },
      // ── Sports & fitness ──────────────────────────────────────────────────────
      { code: '9506', description: 'Articles and equipment for general physical exercise, gymnastics', gstRate: 18 },
      { code: '9507', description: 'Fishing rods, fish-hooks and other line fishing tackles', gstRate: 12 },
      // ── Games & toys ──────────────────────────────────────────────────────────
      { code: '9503', description: 'Tricycles, scooters, pedal cars, dolls, toy cars', gstRate: 12 },
      { code: '9504', description: 'Video game consoles and machines, playing cards, chess', gstRate: 18 },
      // ── Furniture ─────────────────────────────────────────────────────────────
      { code: '9401', description: 'Seats (other than those of heading 9402)', gstRate: 18 },
      { code: '9402', description: 'Medical, surgical, dental or veterinary furniture', gstRate: 12 },
      { code: '9403', description: 'Other furniture and parts thereof', gstRate: 18 },
      { code: '9404', description: 'Mattress supports; mattresses, sleeping bags', gstRate: 18 },
      // ── Lighting ──────────────────────────────────────────────────────────────
      { code: '9405', description: 'Luminaires and lighting fittings; illuminated signs', gstRate: 12 },
      // ── Medical & pharma ──────────────────────────────────────────────────────
      { code: '3003', description: 'Medicaments (excluding goods of headings 3002, 3005)', gstRate: 12 },
      { code: '3004', description: 'Medicaments in measured doses or packaged for retail sale', gstRate: 12 },
      { code: '3005', description: 'Wadding, gauze, bandages and similar articles', gstRate: 12 },
      { code: '3006', description: 'Pharmaceutical goods specified in Note 4 to this Chapter', gstRate: 12 },
      { code: '9018', description: 'Instruments and appliances used in medical/surgical sciences', gstRate: 12 },
      { code: '9021', description: 'Orthopaedic appliances; splints; hearing aids; pacemakers', gstRate: 5 },
      // ── Cosmetics & personal care ─────────────────────────────────────────────
      { code: '3301', description: 'Essential oils; resinoids; extracted oleoresins', gstRate: 18 },
      { code: '3303', description: 'Perfumes and toilet waters', gstRate: 18 },
      { code: '3304', description: 'Beauty or make-up preparations; skin care preparations', gstRate: 18 },
      { code: '3305', description: 'Preparations for use on the hair — shampoos, conditioners', gstRate: 18 },
      { code: '3306', description: 'Preparations for oral or dental hygiene including toothpaste', gstRate: 18 },
      { code: '3307', description: 'Pre-shave, shaving or after-shave preparations; deodorants', gstRate: 18 },
      // ── Detergents & soap ─────────────────────────────────────────────────────
      { code: '3401', description: 'Soap; organic surface-active products in bar, cake or moulded form', gstRate: 18 },
      { code: '3402', description: 'Organic surface-active agents (washing powders and preparations)', gstRate: 18 },
      { code: '3406', description: 'Candles, tapers and the like', gstRate: 12 },
      // ── Paints & varnishes ────────────────────────────────────────────────────
      { code: '3208', description: 'Paints and varnishes based on synthetic or modified polymers', gstRate: 18 },
      { code: '3209', description: 'Paints and varnishes based on acrylic or vinyl polymers in water', gstRate: 18 },
      // ── Vehicles ─────────────────────────────────────────────────────────────
      { code: '8703', description: 'Motor cars and other vehicles for transport of persons', gstRate: 28 },
      { code: '8711', description: 'Motorcycles (including mopeds)', gstRate: 28 },
      { code: '8712', description: 'Bicycles and other cycles', gstRate: 12 },
      { code: '8716', description: 'Trailers and semi-trailers; other vehicles not mechanically propelled', gstRate: 28 },
      // ── Parts & accessories for vehicles ─────────────────────────────────────
      { code: '8708', description: 'Parts and accessories of motor vehicles', gstRate: 28 },
      // ── Bags & luggage ────────────────────────────────────────────────────────
      { code: '6304', description: 'Other furnishing articles — bed linen, table linen', gstRate: 5 },
      { code: '6305', description: 'Sacks and bags of a kind used for packing of goods', gstRate: 12 },
      { code: '6306', description: 'Tarpaulins, awnings and sunblinds; tents; sails', gstRate: 12 },
      // ── Bedding & home textiles ───────────────────────────────────────────────
      { code: '6301', description: 'Blankets and travelling rugs', gstRate: 5 },
      { code: '6302', description: 'Bed linen, table linen, toilet linen and kitchen linen', gstRate: 5 },
      { code: '6303', description: 'Curtains (including drapes) and interior blinds', gstRate: 5 },
      // ── Office supplies ───────────────────────────────────────────────────────
      { code: '9608', description: 'Ball point pens; felt tipped and other porous-tipped pens', gstRate: 12 },
      { code: '9609', description: 'Pencils, crayons, pencil leads, pastels, drawing charcoals', gstRate: 12 },
    ];

    let created = 0;
    let skipped = 0;

    for (const item of standardCodes) {
      const existing = await this.findByCode(item.code);
      if (existing) {
        skipped++;
      } else {
        await this.create(item);
        created++;
      }
    }

    return { created, skipped };
  }

  async search(query: string): Promise<HsnCode[]> {
    const searchPattern = `%${query.toLowerCase()}%`;
    
    return await this.hsnCodeRepository
      .createQueryBuilder('hsn')
      .where('hsn.isActive = :isActive', { isActive: true })
      .andWhere(
        '(LOWER(hsn.code) LIKE :search OR LOWER(hsn.description) LIKE :search)',
        { search: searchPattern }
      )
      .orderBy('hsn.code', 'ASC')
      .getMany();
  }

  // ── Runtime CBIC fetch ────────────────────────────────────────────────────

  async fetchFromCBIC(): Promise<{ codes: Array<{ code: string; description: string; gstRate: number }>; source: string }> {
    const urls = [
      'https://cbic-gst.gov.in/gst-goods-services-rates.html',
      'https://cbic-gst.gov.in/hindi/gst-goods-services-rates.html',
    ];

    for (const url of urls) {
      try {
        const html = await this.httpGet(url);
        const codes = this.parseHTMLForHSNCodes(html);
        if (codes.length >= 10) {
          return { codes, source: `Live CBIC data from ${url}` };
        }
      } catch (_) {
        // try next URL
      }
    }

    throw new Error('Failed to fetch or parse CBIC website');
  }

  private httpGet(url: string, maxRedirects = 5): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;

      const options: https.RequestOptions = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; marketplace-hsn-sync/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 30000,
        // Government sites sometimes have certificate chain issues
        rejectUnauthorized: false,
      };

      const req = lib.request(options, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode ?? 0) && res.headers.location && maxRedirects > 0) {
          const nextUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${parsed.protocol}//${parsed.hostname}${res.headers.location}`;
          resolve(this.httpGet(nextUrl, maxRedirects - 1));
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} from ${url}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        res.on('error', reject);
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
      req.end();
    });
  }

  private parseHTMLForHSNCodes(html: string): Array<{ code: string; description: string; gstRate: number }> {
    const results: Array<{ code: string; description: string; gstRate: number }> = [];
    const seen = new Set<string>();

    const stripTags = (s: string) =>
      s.replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim();

    // Remove scripts and styles
    const cleaned = html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');

    // Match all <tr> blocks (non-greedy)
    const trRegex = /<tr(?:\s[^>]*)?>[\s\S]*?<\/tr>/gi;
    const tdRegex = /<td(?:\s[^>]*)?>[\s\S]*?<\/td>/gi;

    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRegex.exec(cleaned)) !== null) {
      const cells: string[] = [];
      let tdMatch: RegExpExecArray | null;
      const tdRe = new RegExp(tdRegex.source, 'gi');
      while ((tdMatch = tdRe.exec(trMatch[0])) !== null) {
        cells.push(stripTags(tdMatch[0]));
      }

      // CBIC table columns: [Schedule, SlNo, HSNCode, Description, CGST%, SGST%, IGST%, Cess]
      if (cells.length < 6) continue;

      const hsnCodeCell = cells[2] || '';
      const description = cells[3] || '';
      const igstCell = cells[6] || cells[5] || '';

      if (!hsnCodeCell || !description || !igstCell) continue;
      if (/omit/i.test(description) || !/\d/.test(hsnCodeCell)) continue;

      // Parse IGST rate (handles "5%", "5", "0.25%", "0")
      const rateMatch = igstCell.match(/(\d+(?:\.\d+)?)/);
      if (!rateMatch) continue;
      const gstRate = parseFloat(rateMatch[1]);
      if (isNaN(gstRate) || gstRate > 100) continue;

      // Handle multiple comma-separated codes e.g. "0202, 0203, 0204"
      const codeParts = hsnCodeCell.split(/[,;]/).map(p => p.trim());
      for (const part of codeParts) {
        // Extract leading digit block (ignores qualifiers like "other than", ranges like "5004 to 5006" → take first)
        const codeMatch = part.match(/^(\d[\d\s]{1,9})/);
        if (!codeMatch) continue;
        const code = codeMatch[1].replace(/\s/g, '').substring(0, 8);
        if (code.length < 2 || seen.has(code)) continue;
        seen.add(code);

        results.push({ code, description: description.substring(0, 500), gstRate });
      }
    }

    return results;
  }
}

