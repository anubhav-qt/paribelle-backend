import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { HsnCodesService, CreateHsnCodeDto, UpdateHsnCodeDto } from './hsn-codes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import * as XLSX from 'xlsx';

// Define Multer File type to avoid Express namespace issues
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

// Official CBIC GST HSN codes data sourced from cbic-gst.gov.in
const OFFICIAL_HSN_CODES: Array<{ code: string; description: string; gstRate: number }> = [
  // Schedule I - 5%
  { code: '0202', description: 'Meat of bovine animals, frozen (pre-packaged and labelled)', gstRate: 5 },
  { code: '0203', description: 'Meat of swine, frozen (pre-packaged and labelled)', gstRate: 5 },
  { code: '0204', description: 'Meat of sheep or goats, frozen (pre-packaged and labelled)', gstRate: 5 },
  { code: '0207', description: 'Meat of poultry, frozen (pre-packaged and labelled)', gstRate: 5 },
  { code: '0303', description: 'Fish, frozen (pre-packaged and labelled)', gstRate: 5 },
  { code: '0304', description: 'Fish fillets and other fish meat, frozen (pre-packaged and labelled)', gstRate: 5 },
  { code: '0401', description: 'Ultra High Temperature (UHT) milk', gstRate: 5 },
  { code: '0402', description: 'Milk and cream, concentrated or containing added sugar (incl. skimmed milk powder)', gstRate: 5 },
  { code: '0403', description: 'Yoghurt; fermented or acidified milk and cream', gstRate: 5 },
  { code: '0406', description: 'Chena or paneer, pre-packaged and labelled', gstRate: 5 },
  { code: '0409', description: 'Natural honey, pre-packaged and labelled', gstRate: 5 },
  { code: '0713', description: 'Dried leguminous vegetables, shelled (pre-packaged and labelled)', gstRate: 5 },
  { code: '0801', description: 'Cashew nuts; desiccated coconuts', gstRate: 5 },
  { code: '0802', description: 'Dried areca nuts / walnuts, whether or not shelled', gstRate: 5 },
  { code: '0806', description: 'Grapes, dried, and raisins', gstRate: 5 },
  { code: '0901', description: 'Coffee roasted, whether or not decaffeinated', gstRate: 5 },
  { code: '0902', description: 'Tea, whether or not flavoured', gstRate: 5 },
  { code: '0904', description: 'Pepper of the genus Piper; dried or crushed fruits of Capsicum', gstRate: 5 },
  { code: '0905', description: 'Vanilla', gstRate: 5 },
  { code: '0906', description: 'Cinnamon and cinnamon-tree flowers', gstRate: 5 },
  { code: '0907', description: 'Cloves (whole fruit, cloves and stems)', gstRate: 5 },
  { code: '0908', description: 'Nutmeg, mace and cardamoms', gstRate: 5 },
  { code: '0909', description: 'Seeds of anise, badian, fennel, coriander, cumin or caraway; juniper berries', gstRate: 5 },
  { code: '0910', description: 'Ginger (other than fresh), saffron, turmeric (other than fresh), thyme, bay leaves, curry and other spices', gstRate: 5 },
  { code: '1001', description: 'Wheat and meslin, pre-packaged and labelled', gstRate: 5 },
  { code: '1002', description: 'Rye, pre-packaged and labelled', gstRate: 5 },
  { code: '1003', description: 'Barley, pre-packaged and labelled', gstRate: 5 },
  { code: '1004', description: 'Oats, pre-packaged and labelled', gstRate: 5 },
  { code: '1005', description: 'Maize (corn), pre-packaged and labelled', gstRate: 5 },
  { code: '1006', description: 'Rice, pre-packaged and labelled', gstRate: 5 },
  { code: '1007', description: 'Grain sorghum, pre-packaged and labelled', gstRate: 5 },
  { code: '1008', description: 'Buckwheat, millet and canary seed; other cereals such as Jawar, Bajra, Ragi (pre-packaged)', gstRate: 5 },
  { code: '1101', description: 'Wheat or meslin flour, pre-packaged and labelled', gstRate: 5 },
  { code: '1102', description: 'Cereal flours other than of wheat or meslin (maize, rye, etc.), pre-packaged', gstRate: 5 },
  { code: '1103', description: 'Cereal groats, meal and pellets including suji and dalia, pre-packaged', gstRate: 5 },
  { code: '1105', description: 'Meal, powder, flakes, granules and pellets of potatoes, pre-packaged', gstRate: 5 },
  { code: '1106', description: 'Meal and powder of dried leguminous vegetables (pulses), pre-packaged', gstRate: 5 },
  { code: '1201', description: 'Soya beans, whether or not broken', gstRate: 5 },
  { code: '1202', description: 'Ground-nuts, not roasted or otherwise cooked', gstRate: 5 },
  { code: '1204', description: 'Linseed, whether or not broken', gstRate: 5 },
  { code: '1205', description: 'Rape or colza seeds, whether or not broken', gstRate: 5 },
  { code: '1206', description: 'Sunflower seeds, whether or not broken', gstRate: 5 },
  { code: '1301', description: 'Natural gums, resins, gum-resins and oleoresins (e.g. balsams)', gstRate: 5 },
  { code: '1507', description: 'Soya-bean oil and its fractions', gstRate: 5 },
  { code: '1508', description: 'Ground-nut oil and its fractions', gstRate: 5 },
  { code: '1509', description: 'Olive oil and its fractions', gstRate: 5 },
  { code: '1511', description: 'Palm oil and its fractions', gstRate: 5 },
  { code: '1512', description: 'Sunflower-seed, safflower or cotton-seed oil and fractions', gstRate: 5 },
  { code: '1513', description: 'Coconut (copra), palm kernel or babassu oil and fractions', gstRate: 5 },
  { code: '1514', description: 'Rape, colza or mustard oil and fractions', gstRate: 5 },
  { code: '1515', description: 'Other fixed vegetable or microbial fats and oils and their fractions', gstRate: 5 },
  { code: '1516', description: 'Vegetable fats and oils, partly or wholly hydrogenated', gstRate: 5 },
  { code: '1701', description: 'Jaggery of all types including Cane Jaggery (gur), Palmyra Jaggery (pre-packaged)', gstRate: 5 },
  { code: '1801', description: 'Cocoa beans whole or broken, raw or roasted', gstRate: 5 },
  { code: '1802', description: 'Cocoa shells, husks, skins and other cocoa waste', gstRate: 5 },
  { code: '1803', description: 'Cocoa paste whether or not de-fatted', gstRate: 5 },
  { code: '1902', description: 'Seviyan (vermicelli)', gstRate: 5 },
  { code: '1903', description: 'Tapioca and substitutes prepared from starch (sabudana)', gstRate: 5 },
  { code: '1905', description: 'Pizza bread; khakhra; plain chapatti or roti; rusks and toasted bread', gstRate: 5 },
  { code: '2106', description: 'Sweetmeats; roasted gram; idli/dosa batter; chutney powder', gstRate: 5 },
  { code: '2301', description: 'Flours, meals and pellets of meat, fish or aquatic invertebrates', gstRate: 5 },
  { code: '3101', description: 'Animal or vegetable fertilisers or organic fertilisers, pre-packaged', gstRate: 5 },
  { code: '3102', description: 'Mineral or chemical fertilisers, nitrogenous', gstRate: 5 },
  { code: '3103', description: 'Mineral or chemical fertilisers, phosphatic', gstRate: 5 },
  { code: '3104', description: 'Mineral or chemical fertilisers, potassic', gstRate: 5 },
  { code: '3105', description: 'Mineral or chemical fertilisers containing two or three fertilising elements', gstRate: 5 },
  { code: '3307', description: 'Agarbatti, lobhan, dhoop batti, dhoop, sambraani', gstRate: 5 },
  { code: '4001', description: 'Natural rubber, balata, gutta-percha, guayule, chicle and similar natural gums', gstRate: 5 },
  { code: '4011', description: 'New pneumatic tyres of rubber for aircraft; bicycles and cycle-rickshaws', gstRate: 5 },
  { code: '4013', description: 'Inner tubes of rubber for bicycles and cycle-rickshaws', gstRate: 5 },
  { code: '4016', description: 'Erasers (of vulcanised rubber)', gstRate: 5 },
  { code: '4101', description: 'Raw hides and skins of bovine (including buffalo) or equine animals', gstRate: 5 },
  { code: '4102', description: 'Raw skins of sheep or lambs', gstRate: 5 },
  { code: '4103', description: 'Other raw hides and skins', gstRate: 5 },
  { code: '4104', description: 'Tanned or crust hides and skins of bovine (including buffalo) or equine animals', gstRate: 5 },
  { code: '4105', description: 'Tanned or crust skins of sheep or lambs', gstRate: 5 },
  { code: '4106', description: 'Tanned or crust hides and skins of other animals', gstRate: 5 },
  { code: '4801', description: 'Newsprint, in rolls or sheets', gstRate: 5 },
  { code: '4901', description: 'Brochures, leaflets and similar printed matter', gstRate: 5 },
  { code: '5004', description: 'Silk yarn', gstRate: 5 },
  { code: '5007', description: 'Woven fabrics of silk or of silk waste', gstRate: 5 },
  { code: '5105', description: 'Wool and fine or coarse animal hair, carded or combed', gstRate: 5 },
  { code: '5106', description: 'Yarn of wool or of animal hair', gstRate: 5 },
  { code: '5111', description: 'Woven fabrics of wool or of animal hair', gstRate: 5 },
  { code: '5201', description: 'Cotton and cotton waste', gstRate: 5 },
  { code: '5302', description: 'True hemp (Cannabis sativa L), raw or processed but not spun', gstRate: 5 },
  { code: '5303', description: 'All textile bast fibres other than jute fibres', gstRate: 5 },
  { code: '5407', description: 'Woven fabrics of manmade textile materials (filament)', gstRate: 5 },
  { code: '5512', description: 'Woven fabrics of manmade staple fibres', gstRate: 5 },
  { code: '6109', description: 'T-shirts, singlets and other vests, of cotton or man-made fibres', gstRate: 5 },
  { code: '6203', description: 'Men\'s or boys\' suits, ensembles, jackets, blazers, trousers', gstRate: 5 },
  // Schedule II - 12%
  { code: '0101', description: 'Live horses', gstRate: 12 },
  { code: '0402', description: 'Condensed milk', gstRate: 12 },
  { code: '0405', description: 'Butter and other fats derived from milk; dairy spreads', gstRate: 12 },
  { code: '0406', description: 'Cheese', gstRate: 12 },
  { code: '0804', description: 'Dates (soft or hard), figs, pineapples, avocados, guavas, mangoes (dried)', gstRate: 12 },
  { code: '1108', description: 'Starches; inulin', gstRate: 12 },
  { code: '1501', description: 'Pig fats (including lard) and poultry fat', gstRate: 12 },
  { code: '1502', description: 'Fats of bovine animals, sheep or goats', gstRate: 12 },
  { code: '1517', description: 'Edible mixtures or preparations of animal fats or oils (excluding heading 1516)', gstRate: 12 },
  { code: '1704', description: 'Sugar boiled confectionery', gstRate: 12 },
  { code: '1804', description: 'Chocolate and other food preparations containing cocoa', gstRate: 12 },
  { code: '2008', description: 'Fruit, nuts and other edible parts of plants, otherwise prepared or preserved', gstRate: 12 },
  { code: '2009', description: 'Fruit or nut juices and vegetable juices, unfermented', gstRate: 12 },
  { code: '2103', description: 'Sauces and preparations; mixed condiments and mixed seasonings; mustard', gstRate: 12 },
  { code: '2202', description: 'Drinking water packed in 20 litre bottles; soya milk drinks; fruit pulp based drinks', gstRate: 12 },
  { code: '3001', description: 'Glands and other organs for organo-therapeutic uses, dried; extracts', gstRate: 12 },
  { code: '3002', description: 'Animal blood prepared for therapeutic or diagnostic uses; antisera', gstRate: 12 },
  { code: '3003', description: 'Medicaments consisting of two or more constituents mixed together (not in measured doses)', gstRate: 12 },
  { code: '3004', description: 'Medicaments consisting of mixed or unmixed products for therapeutic use (retail sale)', gstRate: 12 },
  { code: '3005', description: 'Wadding, gauze, bandages and similar articles for medical, surgical, dental or veterinary purposes', gstRate: 12 },
  { code: '3006', description: 'Pharmaceutical goods - sterile surgical materials, ostomy appliances', gstRate: 12 },
  { code: '3306', description: 'Tooth powder', gstRate: 12 },
  { code: '3406', description: 'Candles, tapers and the like', gstRate: 12 },
  { code: '3701', description: 'Photographic plates and film for x-ray for medical use', gstRate: 12 },
  { code: '3926', description: 'Feeding bottles; plastic beads', gstRate: 12 },
  { code: '4007', description: 'Latex rubber thread', gstRate: 12 },
  { code: '4014', description: 'Nipples of feeding bottles', gstRate: 12 },
  { code: '4015', description: 'Surgical rubber gloves or medical examination rubber gloves', gstRate: 12 },
  { code: '4107', description: 'Leather further prepared after tanning, bovine or equine animals', gstRate: 12 },
  { code: '4112', description: 'Leather further prepared after tanning, sheep or lamb', gstRate: 12 },
  { code: '4113', description: 'Leather further prepared after tanning, other animals', gstRate: 12 },
  { code: '4114', description: 'Chamois leather; patent leather; metallised leather', gstRate: 12 },
  { code: '4202', description: 'Hand bags and shopping bags, of cotton or jute', gstRate: 12 },
  { code: '4203', description: 'Gloves specially designed for use in sports', gstRate: 12 },
  { code: '4415', description: 'Packing cases, boxes, crates, drums and similar packings of wood', gstRate: 12 },
  { code: '4416', description: 'Casks, barrels, vats, tubs and other coopers\' products of wood', gstRate: 12 },
  { code: '4417', description: 'Tools, tool bodies, tool handles, broom or brush bodies, of wood', gstRate: 12 },
  { code: '4701', description: 'Mechanical wood pulp', gstRate: 12 },
  { code: '4702', description: 'Chemical wood pulp, dissolving grades', gstRate: 12 },
  { code: '4703', description: 'Chemical wood pulp, soda or sulphate', gstRate: 12 },
  { code: '4704', description: 'Chemical wood pulp, sulphite', gstRate: 12 },
  { code: '4705', description: 'Wood pulp obtained by combination of mechanical and chemical pulping', gstRate: 12 },
  { code: '4802', description: 'Uncoated paper and paperboard for writing, printing or other graphic purposes', gstRate: 12 },
  { code: '4804', description: 'Uncoated kraft paper and paperboard, in rolls or sheets', gstRate: 12 },
  { code: '4820', description: 'Exercise book, graph book, laboratory note book and notebooks', gstRate: 12 },
  { code: '5401', description: 'Sewing thread of manmade filaments', gstRate: 12 },
  { code: '5402', description: 'Synthetic or artificial filament yarns', gstRate: 12 },
  { code: '5508', description: 'Sewing thread of manmade staple fibres', gstRate: 12 },
  { code: '5509', description: 'Yarn of manmade staple fibres', gstRate: 12 },
  { code: '5601', description: 'Wadding of textile materials and articles thereof; absorbent cotton wool', gstRate: 12 },
  { code: '5602', description: 'Felt, whether or not impregnated, coated, covered or laminated', gstRate: 12 },
  { code: '5603', description: 'Nonwovens, whether or not impregnated, coated, covered or laminated', gstRate: 12 },
  { code: '5701', description: 'Carpets and other textile floor coverings, knotted', gstRate: 12 },
  { code: '5702', description: 'Carpets and other textile floor coverings, woven (not tufted or flocked)', gstRate: 12 },
  { code: '5703', description: 'Carpets and other textile floor coverings, tufted', gstRate: 12 },
  { code: '5802', description: 'Terry towelling and similar woven terry fabrics; tufted textile fabrics', gstRate: 12 },
  { code: '6603', description: 'Parts, trimmings and accessories of umbrellas or walking-sticks', gstRate: 12 },
  { code: '6802', description: 'Statues, statuettes, pedestals and ornamental goods of stone', gstRate: 12 },
  { code: '6815', description: 'Fly ash bricks; fly ash aggregates; fly ash blocks', gstRate: 12 },
  { code: '6904', description: 'Building bricks', gstRate: 12 },
  { code: '7015', description: 'Glasses for corrective spectacles and flint buttons', gstRate: 12 },
  { code: '7317', description: 'Animal shoe nails', gstRate: 12 },
  { code: '7319', description: 'Sewing needles', gstRate: 12 },
  { code: '7321', description: 'Kerosene burners, kerosene stoves and wood burning stoves of iron or steel', gstRate: 12 },
  { code: '7323', description: 'Table, kitchen or other household articles of iron and steel; utensils', gstRate: 12 },
  { code: '7418', description: 'Table, kitchen or other household articles of copper; utensils', gstRate: 12 },
  { code: '7615', description: 'Table, kitchen or other household articles of aluminium; utensils', gstRate: 12 },
  { code: '8306', description: 'Bells, gongs and the like, non-electric, of base metal; statuettes and ornaments', gstRate: 12 },
  { code: '8433', description: 'Harvesting or threshing machinery including straw or fodder balers; hay mowers', gstRate: 12 },
  { code: '8452', description: 'Sewing machines; furniture and bases for sewing machines; needles', gstRate: 12 },
  { code: '8712', description: 'Bicycles and other cycles (including delivery tricycles), not motorised', gstRate: 12 },
  { code: '8714', description: 'Parts and accessories of bicycles and other cycles, not motorised', gstRate: 12 },
  { code: '9001', description: 'Contact lenses; spectacle lenses', gstRate: 12 },
  { code: '9003', description: 'Frames and mountings for spectacles, goggles or the like', gstRate: 12 },
  { code: '9004', description: 'Spectacles, corrective', gstRate: 12 },
  { code: '9018', description: 'Instruments and appliances used in medical, surgical, dental or veterinary sciences', gstRate: 12 },
  { code: '9507', description: 'Fishing rods, line fishing tackle; fish landing nets', gstRate: 12 },
  { code: '9608', description: 'Pencils (including propelling or sliding pencils), crayons, pastels, drawing charcoals', gstRate: 12 },
  { code: '9615', description: 'Combs, hair-slides and the like; hairpins, curling pins', gstRate: 12 },
  // Schedule III - 18%
  { code: '1107', description: 'Malt, whether or not roasted', gstRate: 18 },
  { code: '1302', description: 'Vegetable saps and extracts; pectic substances; agar-agar and other mucilages', gstRate: 18 },
  { code: '1702', description: 'Other sugars including chemically pure lactose, maltose, glucose and fructose', gstRate: 18 },
  { code: '2101', description: 'Extracts, essences and concentrates of tea or mate', gstRate: 18 },
  { code: '2104', description: 'Soups and broths and preparations therefor; homogenised composite food preparations', gstRate: 18 },
  { code: '2105', description: 'Ice cream and other edible ice, whether or not containing cocoa', gstRate: 18 },
  { code: '2209', description: 'Vinegar and substitutes for vinegar obtained from acetic acid', gstRate: 18 },
  { code: '2710', description: 'Petroleum oils, mineral oils (other than kerosene PDS, petrol, diesel and ATF)', gstRate: 18 },
  { code: '2712', description: 'Petroleum jelly; paraffin wax; micro-crystalline petroleum wax; ozokerite', gstRate: 18 },
  { code: '2713', description: 'Petroleum coke, petroleum bitumen and other residues of petroleum oils', gstRate: 18 },
  { code: '2707', description: 'Oils and other products of the distillation of high temperature coal tar', gstRate: 18 },
  { code: '2708', description: 'Pitch and pitch coke, obtained from coal tar or from other mineral tars', gstRate: 18 },
  { code: '2801', description: 'Iodine', gstRate: 18 },
  { code: '2847', description: 'Medicinal grade hydrogen peroxide', gstRate: 18 },
  { code: '3201', description: 'Tanning extracts of vegetable origin; tannins and their derivatives', gstRate: 18 },
  { code: '3202', description: 'Synthetic organic tanning substances; inorganic tanning substances', gstRate: 18 },
  { code: '3203', description: 'Colouring matter of vegetable or animal origin', gstRate: 18 },
  { code: '3206', description: 'Other colouring matter; preparations specified in Note 3 to Chapter 32', gstRate: 18 },
  { code: '3207', description: 'Prepared pigments, opacifiers; vitrifiable enamels and glazes; glass frit', gstRate: 18 },
  { code: '3208', description: 'Paints and varnishes based on synthetic polymers in non-aqueous medium', gstRate: 18 },
  { code: '3209', description: 'Paints and varnishes based on synthetic polymers in aqueous medium', gstRate: 18 },
  { code: '3210', description: 'Other paints and varnishes; prepared water pigments for finishing leather', gstRate: 18 },
  { code: '3213', description: 'Artists\', students\' or signboard painters\' colours, amusement colours', gstRate: 18 },
  { code: '3214', description: 'Glaziers\' putty, grafting putty, resin cements, caulking compounds and mastics', gstRate: 18 },
  { code: '3215', description: 'Printing ink, writing or drawing ink and other inks; fountain pen ink, ball pen ink', gstRate: 18 },
  { code: '3301', description: 'Essential oils; resinoids; extracted oleoresins; flavouring essences', gstRate: 18 },
  { code: '3302', description: 'Mixtures of odoriferous substances used as raw materials in industry', gstRate: 18 },
  { code: '3303', description: 'Perfumes and toilet waters', gstRate: 18 },
  { code: '3304', description: 'Beauty or make-up preparations and preparations for the care of the skin', gstRate: 18 },
  { code: '3305', description: 'Preparations for use on the hair', gstRate: 18 },
  { code: '3306', description: 'Preparations for oral or dental hygiene; dental floss', gstRate: 18 },
  { code: '3307', description: 'Pre-shave, shaving or after-shave preparations; personal deodorants; bath preparations', gstRate: 18 },
  { code: '3401', description: 'Soap; organic surface-active products and preparations for use as soap', gstRate: 18 },
  { code: '3402', description: 'Organic surface-active agents (other than soap); surface-active preparations; washing preparations', gstRate: 18 },
  { code: '3403', description: 'Lubricating preparations', gstRate: 18 },
  { code: '3404', description: 'Artificial waxes and prepared waxes', gstRate: 18 },
  { code: '3405', description: 'Polishes and creams for footwear, furniture, floors, coachwork, glass or metal', gstRate: 18 },
  { code: '3407', description: 'Modelling pastes; dental wax; dental impression compounds', gstRate: 18 },
  { code: '3501', description: 'Casein, caseinates and other casein derivatives; casein glues', gstRate: 18 },
  { code: '3504', description: 'Peptones and their derivatives; other protein substances; hide powder', gstRate: 18 },
  { code: '3505', description: 'Dextrins and other modified starches; glues based on starches', gstRate: 18 },
  { code: '3506', description: 'Prepared glues and other prepared adhesives, not elsewhere specified', gstRate: 18 },
  { code: '3507', description: 'Enzymes, prepared enzymes', gstRate: 18 },
  { code: '3601', description: 'Propellant powders', gstRate: 18 },
  { code: '3602', description: 'Prepared explosives; industrial explosives', gstRate: 18 },
  { code: '3603', description: 'Safety fuses; detonating cords; percussion or detonating caps; igniters; electric detonators', gstRate: 18 },
  { code: '3604', description: 'Fireworks, signalling flares, rain rockets, fog signals and other pyrotechnic articles', gstRate: 18 },
  { code: '3703', description: 'Photographic paper, paperboard and textiles, sensitised, unexposed', gstRate: 18 },
  { code: '3801', description: 'Artificial graphite; colloidal or semi-colloidal graphite; preparations based on graphite', gstRate: 18 },
  { code: '3802', description: 'Activated carbon; activated natural mineral products; animal black', gstRate: 18 },
  { code: '3805', description: 'Gum, wood or sulphate turpentine and other terpenic oils', gstRate: 18 },
  { code: '3806', description: 'Rosin and resin acids, and derivatives thereof; rosin spirit and rosin oils', gstRate: 18 },
  { code: '3808', description: 'Insecticides, rodenticides, fungicides, herbicides, anti-sprouting products', gstRate: 18 },
  { code: '3812', description: 'Prepared rubber accelerators; compound plasticisers for rubber or plastics', gstRate: 18 },
  { code: '3901', description: 'Polymers and plastics in primary forms (polyethylene, polyesters, polyamides, etc.)', gstRate: 18 },
  { code: '3914', description: 'Ion exchangers based on polymers, in primary forms', gstRate: 18 },
  { code: '3916', description: 'Monofilament of which any cross-sectional dimension exceeds 1 mm; rods, sticks', gstRate: 18 },
  { code: '3917', description: 'Tubes, pipes and hoses, and fittings therefor, of plastics', gstRate: 18 },
  { code: '3919', description: 'Self-adhesive plates, sheets, film, foil, tape, strip and other flat shapes of plastics', gstRate: 18 },
  { code: '3923', description: 'Articles for the conveyance or packing of goods, of plastics', gstRate: 18 },
  { code: '3924', description: 'Tableware, kitchenware, other household articles and hygienic or toilet articles of plastics', gstRate: 18 },
  { code: '3925', description: 'Builder\'s wares of plastics', gstRate: 18 },
  { code: '3926', description: 'Other articles of plastics and articles of other materials (headings 3901 to 3914)', gstRate: 18 },
  { code: '4005', description: 'Compounded rubber, unvulcanised, in primary forms or in plates, sheets or strip', gstRate: 18 },
  { code: '4007', description: 'Vulcanised rubber thread and cord, other than latex rubber thread', gstRate: 18 },
  { code: '4014', description: 'Hygienic or pharmaceutical articles of vulcanised rubber (hot water bottles, ice bags)', gstRate: 18 },
  { code: '4015', description: 'Articles of apparel and clothing accessories of vulcanised rubber (excluding surgical gloves)', gstRate: 18 },
  { code: '4203', description: 'Articles of apparel and clothing accessories, of leather', gstRate: 18 },
  { code: '4205', description: 'Other articles of leather or of composition leather', gstRate: 18 },
  { code: '4301', description: 'Raw furskins including heads, tails, paws and other pieces', gstRate: 18 },
  { code: '4302', description: 'Tanned or dressed furskins including heads, tails, paws', gstRate: 18 },
  { code: '4303', description: 'Articles of apparel, clothing accessories and other articles of furskin', gstRate: 18 },
  { code: '4304', description: 'Artificial fur and articles thereof', gstRate: 18 },
  { code: '4403', description: 'Wood in the rough', gstRate: 18 },
  { code: '4803', description: 'Toilet or facial tissue stock, towel or napkin stock and similar paper', gstRate: 18 },
  { code: '4809', description: 'Carbon paper, self-copy paper and other copying or transfer papers', gstRate: 18 },
  { code: '4811', description: 'Paper, paperboard, cellulose wadding, coated, impregnated, covered or printed', gstRate: 18 },
  { code: '4818', description: 'Toilet paper and similar paper, cellulose wadding and household/sanitary articles of paper', gstRate: 18 },
  { code: '4819', description: 'Cartons, boxes, cases, bags and other packing containers of paper or paperboard', gstRate: 18 },
  { code: '4820', description: 'Registers, account books, order books, receipt books, letter pads, memorandum pads, diaries', gstRate: 18 },
  { code: '4821', description: 'Paper or paperboard labels of all kinds, whether or not printed', gstRate: 18 },
  { code: '4823', description: 'Other paper, paperboard, cellulose wadding, cut to size or shape', gstRate: 18 },
  { code: '5402', description: 'Synthetic filament yarns', gstRate: 18 },
  { code: '5501', description: 'Synthetic or artificial filament tow', gstRate: 18 },
  { code: '5503', description: 'Synthetic or artificial staple fibres', gstRate: 18 },
  { code: '6810', description: 'Articles of cement, of concrete or of artificial stone, whether or not reinforced', gstRate: 18 },
  { code: '6811', description: 'Articles of asbestos-cement, of cellulose fibre-cement or the like', gstRate: 18 },
  { code: '6805', description: 'Natural or artificial abrasive powder or grain on a base of textile material or paper', gstRate: 18 },
  { code: '6806', description: 'Slag wool, rock wool and similar mineral wools; expanded mineral materials', gstRate: 18 },
  { code: '7019', description: 'Glass fibres (including glass wool) and articles thereof', gstRate: 18 },
  { code: '7301', description: 'Sheet piling of iron or steel; welded angles, shapes and sections of iron or steel', gstRate: 18 },
  { code: '7308', description: 'Structures and parts of structures of iron or steel (bridges, towers, roofs, doors)', gstRate: 18 },
  { code: '7309', description: 'Reservoirs, tanks, vats and similar containers of iron or steel (capacity > 300 L)', gstRate: 18 },
  { code: '7310', description: 'Tanks, casks, drums, cans, boxes and similar containers of iron or steel (capacity ≤ 300 L)', gstRate: 18 },
  { code: '7311', description: 'Containers for compressed or liquefied gas, of iron or steel', gstRate: 18 },
  { code: '7312', description: 'Stranded wire, ropes, cables, plaited bands, slings and the like, of iron or steel', gstRate: 18 },
  { code: '7317', description: 'Nails, tacks, drawing pins, corrugated nails, staples and similar articles of iron or steel', gstRate: 18 },
  { code: '7318', description: 'Screws, bolts, nuts, coach screws, screw hooks, rivets, cotters and washers of iron or steel', gstRate: 18 },
  { code: '7320', description: 'Springs and leaves for springs, of iron and steel', gstRate: 18 },
  { code: '7321', description: 'Stoves, ranges, grates, cookers, barbecues, braziers of iron or steel', gstRate: 18 },
  { code: '7411', description: 'Copper tubes and pipes', gstRate: 18 },
  { code: '7412', description: 'Copper tube or pipe fittings', gstRate: 18 },
  { code: '7413', description: 'Stranded wires and cables of copper', gstRate: 18 },
  { code: '7415', description: 'Nails, screws, bolts, nuts and similar articles of copper or iron with copper heads', gstRate: 18 },
  { code: '7419', description: 'Other articles of copper', gstRate: 18 },
  { code: '7501', description: 'Nickel mattes, nickel oxide sinters and other intermediate products of nickel metallurgy', gstRate: 18 },
  { code: '7502', description: 'Unwrought nickel', gstRate: 18 },
  { code: '7505', description: 'Nickel bars, rods, profiles and wire', gstRate: 18 },
  { code: '7506', description: 'Nickel plates, sheets, strip and foil', gstRate: 18 },
  { code: '7508', description: 'Other articles of nickel', gstRate: 18 },
  { code: '7601', description: 'Unwrought aluminium', gstRate: 18 },
  { code: '7602', description: 'Aluminium waste and scrap', gstRate: 18 },
  { code: '7604', description: 'Aluminium bars, rods and profiles', gstRate: 18 },
  { code: '7605', description: 'Aluminium wire', gstRate: 18 },
  { code: '7606', description: 'Aluminium plates, sheets and strip (thickness > 0.2 mm)', gstRate: 18 },
  { code: '7607', description: 'Aluminium foil (thickness ≤ 0.2 mm)', gstRate: 18 },
  { code: '7608', description: 'Aluminium tubes and pipes', gstRate: 18 },
  { code: '7609', description: 'Aluminium tube or pipe fittings', gstRate: 18 },
  { code: '7612', description: 'Aluminium casks, drums, cans, boxes', gstRate: 18 },
  { code: '7614', description: 'Stranded wires, cables, plaited bands of aluminium, not electrically insulated', gstRate: 18 },
  { code: '7616', description: 'Other articles of aluminium', gstRate: 18 },
  { code: '7801', description: 'Unwrought lead', gstRate: 18 },
  { code: '7804', description: 'Lead plates, sheets, strip and foil; lead powders and flakes', gstRate: 18 },
  { code: '7806', description: 'Other articles of lead (including sanitary fixtures and Indian lead seals)', gstRate: 18 },
  { code: '7901', description: 'Unwrought zinc', gstRate: 18 },
  { code: '7903', description: 'Zinc dust, powders and flakes', gstRate: 18 },
  { code: '7904', description: 'Zinc bars, rods, profiles and wire', gstRate: 18 },
  { code: '7905', description: 'Zinc plates, sheets, strip and foil', gstRate: 18 },
  { code: '7907', description: 'Other articles of zinc including sanitary fixtures', gstRate: 18 },
  { code: '8001', description: 'Unwrought tin', gstRate: 18 },
  { code: '8003', description: 'Tin bars, rods, profiles and wire', gstRate: 18 },
  { code: '8007', description: 'Other articles of tin', gstRate: 18 },
  { code: '8211', description: 'Knives with cutting blades, serrated or not, and blades therefor', gstRate: 18 },
  { code: '8212', description: 'Razors and razor blades (including razor blade blanks in strips)', gstRate: 18 },
  { code: '8213', description: 'Scissors, tailors\' shears and similar shears, and blades therefor', gstRate: 18 },
  { code: '8311', description: 'Wire, rods, tubes, plates, electrodes for soldering, brazing or welding', gstRate: 18 },
  { code: '8401', description: 'Nuclear reactors; machinery and apparatus for isotopes separation', gstRate: 18 },
  { code: '8419', description: 'Machinery for treatment of materials by change of temperature (excluding solar water heater)', gstRate: 18 },
  { code: '8421', description: 'Centrifuges; filtering or purifying machinery and apparatus for liquids or gases', gstRate: 18 },
  { code: '8423', description: 'Weighing machinery; weighing machine weights of all kinds', gstRate: 18 },
  { code: '8424', description: 'Mechanical appliances for projecting or spraying liquids; fire extinguishers; spray guns', gstRate: 18 },
  { code: '8438', description: 'Machinery for industrial preparation or manufacture of food or drink', gstRate: 18 },
  { code: '8439', description: 'Machinery for making pulp of fibrous cellulosic material or for making paper', gstRate: 18 },
  { code: '8452', description: 'Sewing machines (book-sewing machines)', gstRate: 18 },
  { code: '8453', description: 'Machinery for preparing, tanning or working hides, skins or leather', gstRate: 18 },
  { code: '8454', description: 'Converters, ladles, ingot moulds and casting machines for metallurgy', gstRate: 18 },
  { code: '8455', description: 'Metal-rolling mills and rolls therefor', gstRate: 18 },
  { code: '8461', description: 'Machine-tools for planing, shaping, slotting, broaching, gear cutting, sawing', gstRate: 18 },
  { code: '8464', description: 'Machine-tools for working stone, ceramics, concrete or mineral materials', gstRate: 18 },
  { code: '8465', description: 'Machine-tools for working wood, cork, bone, hard rubber or similar hard materials', gstRate: 18 },
  { code: '8466', description: 'Parts and accessories for machine-tools (headings 8456 to 8465)', gstRate: 18 },
  { code: '8467', description: 'Tools for working in the hand, pneumatic, hydraulic or with self-contained motor', gstRate: 18 },
  { code: '8468', description: 'Machinery and apparatus for soldering, brazing or welding', gstRate: 18 },
  { code: '8471', description: 'Automatic data processing machines; magnetic or optical readers', gstRate: 18 },
  { code: '8472', description: 'Other office machines (duplicating, addressing, automatic banknote dispensers)', gstRate: 18 },
  { code: '8473', description: 'Parts and accessories for machines of headings 8470 to 8472', gstRate: 18 },
  { code: '8474', description: 'Machinery for sorting, screening, separating, washing, crushing, grinding, mixing mineral substances', gstRate: 18 },
  { code: '8479', description: 'Machines and mechanical appliances having individual functions (excluding composting machines)', gstRate: 18 },
  { code: '8480', description: 'Moulding boxes for metal foundry; mould bases; moulds for metal, carbides, glass or plastics', gstRate: 18 },
  { code: '8484', description: 'Gaskets and similar joints of metal sheeting combined with other material', gstRate: 18 },
  { code: '8501', description: 'Electric motors and generators (excluding generating sets)', gstRate: 18 },
  { code: '8502', description: 'Electric generating sets and rotary converters', gstRate: 18 },
  { code: '8504', description: 'Electrical transformers, static converters and inductors', gstRate: 18 },
  { code: '8516', description: 'Electric instantaneous or storage water heaters; hair dryers; electric smoothing irons', gstRate: 18 },
  { code: '8517', description: 'Telephone sets; smartphones; modems; routers and other apparatus for transmission', gstRate: 18 },
  { code: '8518', description: 'Microphones and stands; loudspeakers; headphones; audio-frequency electric amplifiers', gstRate: 18 },
  { code: '8519', description: 'Sound recording or reproducing apparatus', gstRate: 18 },
  { code: '8521', description: 'Video recording or reproducing apparatus', gstRate: 18 },
  { code: '8523', description: 'Discs, tapes, solid-state non-volatile storage devices, smart cards for recording', gstRate: 18 },
  { code: '8524', description: 'Flat panel display modules, whether or not incorporating touch-sensitive screens', gstRate: 18 },
  { code: '8531', description: 'Electric sound or visual signalling apparatus (bells, sirens, indicator panels, burglar alarms)', gstRate: 18 },
  { code: '8532', description: 'Electrical capacitors, fixed, variable or adjustable (pre-set)', gstRate: 18 },
  { code: '8533', description: 'Electrical resistors (including rheostats and potentiometers)', gstRate: 18 },
  { code: '8534', description: 'Printed circuits', gstRate: 18 },
  { code: '8535', description: 'Electrical apparatus for switching or protecting electrical circuits (voltage > 1000V)', gstRate: 18 },
  { code: '8537', description: 'Boards, panels, consoles, desks, cabinets for electric control or distribution of electricity', gstRate: 18 },
  { code: '8538', description: 'Parts for apparatus of heading 8535, 8536 or 8537', gstRate: 18 },
  { code: '8539', description: 'Electrical filament or discharge lamps including sealed beam lamp units', gstRate: 18 },
  { code: '8541', description: 'Semiconductor devices; photosensitive semiconductor devices; LEDs', gstRate: 18 },
  { code: '8542', description: 'Electronic integrated circuits', gstRate: 18 },
  { code: '8543', description: 'Electrical machines and apparatus having individual functions', gstRate: 18 },
  { code: '8609', description: 'Containers specially designed for carriage by one or more modes of transport', gstRate: 18 },
  { code: '9016', description: 'Balances of a sensitivity of 5 cg or better, with or without weights', gstRate: 18 },
  { code: '9017', description: 'Drawing, marking-out or mathematical calculating instruments; measuring instruments', gstRate: 18 },
  { code: '9024', description: 'Machines and appliances for testing hardness, strength, compressibility of materials', gstRate: 18 },
  { code: '9025', description: 'Hydrometers, thermometers, pyrometers, barometers, hygrometers and psychrometers', gstRate: 18 },
  { code: '9102', description: 'Wrist-watches, pocket-watches and other watches (other than heading 9101)', gstRate: 18 },
  { code: '9103', description: 'Clocks with watch movements, excluding clocks of heading 9104', gstRate: 18 },
  { code: '9105', description: 'Other clocks', gstRate: 18 },
  { code: '9106', description: 'Time of day recording apparatus; time-registers, time-recorders', gstRate: 18 },
  { code: '9108', description: 'Watch movements, complete and assembled', gstRate: 18 },
  { code: '9109', description: 'Clock movements, complete and assembled', gstRate: 18 },
  { code: '9114', description: 'Other clock or watch parts', gstRate: 18 },
  { code: '9301', description: 'Military weapons other than revolvers and pistols', gstRate: 18 },
  { code: '9402', description: 'Medical, surgical, dental or veterinary furniture (operating tables, hospital beds)', gstRate: 18 },
  { code: '9403', description: 'Other furniture (excluding furniture wholly made of bamboo, cane or rattan) and parts', gstRate: 18 },
  { code: '9405', description: 'Luminaires and lighting fittings; illuminated signs and illuminated nameplates', gstRate: 18 },
  { code: '9406', description: 'Prefabricated buildings', gstRate: 18 },
  { code: '9503', description: 'Electronic toys like tricycles, scooters, pedal cars', gstRate: 18 },
  { code: '9504', description: 'Video game consoles and machines; articles for funfair, table or parlour games', gstRate: 18 },
  { code: '9603', description: 'Brushes including brushes constituting parts of machines; hand mechanical floor sweepers', gstRate: 18 },
  { code: '9606', description: 'Buttons, of plastics; of base metals; buttons of coconut shell; button blanks', gstRate: 18 },
  { code: '9612', description: 'Typewriter or similar ribbons, inked or otherwise prepared; ink-pads', gstRate: 18 },
  { code: '9613', description: 'Cigarette lighters and other lighters, whether or not mechanical or electrical', gstRate: 18 },
  { code: '9617', description: 'Vacuum flasks and other vacuum vessels, complete; parts thereof', gstRate: 18 },
  // Schedule IV - 28%
  { code: '1703', description: 'Molasses', gstRate: 28 },
  { code: '2106', description: 'Pan masala', gstRate: 28 },
  { code: '2202', description: 'Aerated waters containing added sugar or other sweetening matter or flavoured', gstRate: 28 },
  { code: '2401', description: 'Unmanufactured tobacco; tobacco refuse (other than tobacco leaves)', gstRate: 28 },
  { code: '2402', description: 'Cigars, cheroots, cigarillos and cigarettes, of tobacco or of tobacco substitutes', gstRate: 28 },
  { code: '2403', description: 'Other manufactured tobacco and manufactured tobacco substitutes; tobacco extracts', gstRate: 28 },
  { code: '2523', description: 'Portland cement, aluminous cement, slag cement and similar hydraulic cements', gstRate: 28 },
  { code: '8407', description: 'Spark-ignition reciprocating or rotary internal combustion piston engines', gstRate: 28 },
  { code: '8408', description: 'Compression-ignition internal combustion piston engines (diesel or semi-diesel)', gstRate: 28 },
  { code: '8422', description: 'Dish washing machines, household and other', gstRate: 28 },
  { code: '8701', description: 'Road tractors for semi-trailers of engine capacity more than 1800 cc', gstRate: 28 },
  { code: '8711', description: 'Motorcycles (including mopeds) and cycles fitted with an auxiliary motor; side-cars', gstRate: 28 },
  { code: '8903', description: 'Yachts and other vessels for pleasure or sports; rowing boats and canoes', gstRate: 28 },
  { code: '9614', description: 'Smoking pipes (including pipe bowls) and cigar or cigarette holders', gstRate: 28 },
  // Schedule V - 3% (Precious metals/gems)
  { code: '7101', description: 'Pearls, natural or cultured, whether or not worked or graded', gstRate: 3 },
  { code: '7105', description: 'Dust and powder of natural or synthetic precious or semi-precious stones', gstRate: 3 },
  { code: '7106', description: 'Silver (including silver plated with gold or platinum), unwrought or semi-manufactured', gstRate: 3 },
  { code: '7107', description: 'Base metals clad with silver, not further worked than semi-manufactured', gstRate: 3 },
  { code: '7112', description: 'Waste and scrap of precious metal or of metal clad with precious metal', gstRate: 3 },
  { code: '7113', description: 'Articles of jewellery and parts thereof, of precious metal or metal clad with precious metal', gstRate: 3 },
  { code: '7114', description: 'Articles of goldsmiths\' or silversmiths\' wares and parts thereof, of precious metal', gstRate: 3 },
  { code: '7115', description: 'Other articles of precious metal or of metal clad with precious metal', gstRate: 3 },
  { code: '7116', description: 'Articles of natural or cultured pearls, precious or semi-precious stones', gstRate: 3 },
  { code: '7117', description: 'Imitation jewellery (other than bangles of lac/shellac)', gstRate: 3 },
  { code: '7118', description: 'Coin', gstRate: 3 },
  // Schedule VI - 0.25% (Rough diamonds)
  { code: '7102', description: 'Rough diamonds or simply sawn diamonds, industrial or non-industrial', gstRate: 0.25 },
  { code: '7103', description: 'Precious stones (other than diamonds) and semi-precious stones, unset', gstRate: 0.25 },
  { code: '7104', description: 'Synthetic or reconstructed precious or semi-precious stones (unworked)', gstRate: 0.25 },
  // Nil rate items
  { code: '0101', description: 'Live asses, mules and hinnies', gstRate: 0 },
  { code: '0102', description: 'Live bovine animals', gstRate: 0 },
  { code: '0103', description: 'Live swine', gstRate: 0 },
  { code: '0104', description: 'Live sheep and goats', gstRate: 0 },
  { code: '0105', description: 'Live poultry (fowls of the species Gallus domesticus, ducks, geese, turkeys, guinea fowls)', gstRate: 0 },
  { code: '0106', description: 'Other live animals such as mammals, birds, insects', gstRate: 0 },
  { code: '0201', description: 'Meat of bovine animals, fresh and chilled', gstRate: 0 },
  { code: '0301', description: 'Live fish', gstRate: 0 },
  { code: '0302', description: 'Fish, fresh or chilled, excluding fish fillets', gstRate: 0 },
  { code: '0401', description: 'Fresh milk and pasteurised milk, not concentrated nor containing added sugar', gstRate: 0 },
  { code: '0403', description: 'Curd, Lassi, Butter milk (other than pre-packaged and labelled)', gstRate: 0 },
  { code: '0407', description: 'Birds\' eggs, in shell, fresh, preserved or cooked', gstRate: 0 },
  { code: '0409', description: 'Natural honey, other than pre-packaged and labelled', gstRate: 0 },
  { code: '0501', description: 'Human hair, unworked, whether or not washed or scoured; waste of human hair', gstRate: 0 },
  { code: '0506', description: 'Bones and horn-cores, unworked, defatted, simply prepared (not cut to shape)', gstRate: 0 },
  { code: '0511', description: 'Semen including frozen semen', gstRate: 0 },
  { code: '0701', description: 'Potatoes, fresh or chilled', gstRate: 0 },
  { code: '0702', description: 'Tomatoes, fresh or chilled', gstRate: 0 },
  { code: '0703', description: 'Onions, shallots, garlic, leeks and other alliaceous vegetables, fresh or chilled', gstRate: 0 },
  { code: '0704', description: 'Cabbages, cauliflowers, kohlrabi, kale and similar edible brassicas, fresh or chilled', gstRate: 0 },
  { code: '0705', description: 'Lettuce and chicory, fresh or chilled', gstRate: 0 },
  { code: '0712', description: 'Dried vegetables, whole, cut, sliced, broken or in powder, but not further prepared', gstRate: 0 },
  { code: '0714', description: 'Manioc, arrowroot, salep, Jerusalem artichokes, sweet potatoes - fresh or chilled', gstRate: 0 },
  { code: '0801', description: 'Coconuts, fresh or dried, whether or not shelled or peeled', gstRate: 0 },
  { code: '0803', description: 'Bananas, including plantains, fresh or dried', gstRate: 0 },
  { code: '0804', description: 'Dates, figs, pineapples, avocados, guavas, mangoes and mangosteens, fresh', gstRate: 0 },
  { code: '0805', description: 'Citrus fruit such as oranges, mandarins, grapefruit, lemons and limes, fresh', gstRate: 0 },
  { code: '0806', description: 'Grapes, fresh', gstRate: 0 },
  { code: '0807', description: 'Melons (including watermelons) and papaws (papayas), fresh', gstRate: 0 },
  { code: '0808', description: 'Apples, pears and quinces, fresh', gstRate: 0 },
  { code: '0809', description: 'Apricots, cherries, peaches (including nectarines), plums and sloes, fresh', gstRate: 0 },
  { code: '0810', description: 'Other fruit such as strawberries, raspberries, kiwi fruit, pomegranates, lichi, fresh', gstRate: 0 },
  { code: '0901', description: 'Coffee beans, not roasted', gstRate: 0 },
  { code: '0902', description: 'Unprocessed green leaves of tea', gstRate: 0 },
  { code: '1001', description: 'Wheat and meslin other than pre-packaged and labelled', gstRate: 0 },
  { code: '1002', description: 'Rye other than pre-packaged and labelled', gstRate: 0 },
  { code: '1003', description: 'Barley other than pre-packaged and labelled', gstRate: 0 },
  { code: '1005', description: 'Maize (corn) other than pre-packaged and labelled', gstRate: 0 },
  { code: '1006', description: 'Rice other than pre-packaged and labelled', gstRate: 0 },
  { code: '1008', description: 'Buckwheat, millet and canary seed; Jawar, Bajra, Ragi - other than pre-packaged', gstRate: 0 },
  { code: '1301', description: 'Lac and Shellac', gstRate: 0 },
  { code: '2501', description: 'Salt (including table salt and denatured salt) and pure sodium chloride; sea water', gstRate: 0 },
  { code: '2716', description: 'Electrical energy', gstRate: 0 },
  { code: '3002', description: 'Human blood and its components', gstRate: 0 },
  { code: '3006', description: 'All types of contraceptives', gstRate: 0 },
  { code: '3304', description: 'Kajal (other than kajal pencil sticks), Kumkum, Bindi, Sindur, Alta', gstRate: 0 },
  { code: '3926', description: 'Plastic bangles', gstRate: 0 },
  { code: '4014', description: 'Condoms and contraceptives', gstRate: 0 },
  { code: '4401', description: 'Firewood or fuel wood', gstRate: 0 },
  { code: '4402', description: 'Wood charcoal (including shell or nut charcoal), whether or not agglomerated', gstRate: 0 },
  { code: '4802', description: 'Judicial, Non-judicial stamp papers, Court fee stamps sold by Government Treasuries', gstRate: 0 },
  { code: '4901', description: 'Printed books, including Braille books', gstRate: 0 },
  { code: '4902', description: 'Newspapers, journals and periodicals', gstRate: 0 },
  { code: '4903', description: 'Children\'s picture, drawing or colouring books', gstRate: 0 },
  { code: '5001', description: 'Silkworm laying, cocoon', gstRate: 0 },
  { code: '5002', description: 'Raw silk', gstRate: 0 },
  { code: '5003', description: 'Silk waste', gstRate: 0 },
  { code: '5101', description: 'Wool, not carded or combed', gstRate: 0 },
  { code: '5102', description: 'Fine or coarse animal hair, not carded or combed', gstRate: 0 },
  { code: '5103', description: 'Waste of wool or of fine or coarse animal hair', gstRate: 0 },
  { code: '5303', description: 'Jute fibres, raw or processed but not spun', gstRate: 0 },
  { code: '5305', description: 'Coconut, coir fibre', gstRate: 0 },
  { code: '6912', description: 'Earthen pot and clay lamps', gstRate: 0 },
  { code: '7018', description: 'Glass bangles (except those made from precious metals)', gstRate: 0 },
  { code: '8201', description: 'Agricultural implements manually operated or animal driven (hand tools like spades, hoes)', gstRate: 0 },
  { code: '8445', description: 'Charkha for hand spinning of yarns, including amber charkha', gstRate: 0 },
  { code: '8446', description: 'Handloom (weaving machinery)', gstRate: 0 },
  { code: '9021', description: 'Hearing aids', gstRate: 0 },
  { code: '9609', description: 'Slate pencils and chalk sticks', gstRate: 0 },
  { code: '9610', description: 'Slates', gstRate: 0 },
];

@Controller('hsn-codes')
@UseGuards(JwtAuthGuard)
export class HsnCodesController {
  constructor(private hsnCodesService: HsnCodesService) {}

  // Import preset official CBIC HSN codes - must come BEFORE generic POST route
  @Post('import-preset')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async importPreset() {
    let codesToImport: Array<{ code: string; description: string; gstRate: number }>;
    let source: string;

    // Try live fetch from CBIC first
    try {
      const result = await this.hsnCodesService.fetchFromCBIC();
      codesToImport = result.codes;
      source = result.source;
    } catch (fetchError) {
      // Fall back to bundled data if CBIC is unreachable
      codesToImport = OFFICIAL_HSN_CODES;
      source = 'Bundled CBIC data (offline fallback — CBIC website was unreachable)';
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of codesToImport) {
      try {
        const existing = await this.hsnCodesService.findByCode(item.code);
        if (existing) {
          await this.hsnCodesService.update(existing.id, {
            description: item.description,
            gstRate: item.gstRate,
          });
          imported++;
        } else {
          await this.hsnCodesService.create({
            code: item.code,
            description: item.description,
            gstRate: item.gstRate,
          });
          imported++;
        }
      } catch (error) {
        skipped++;
        errors.push(`Error processing HSN code ${item.code}: ${error.message}`);
      }
    }

    return {
      message: 'Official CBIC HSN codes import completed',
      source,
      total: codesToImport.length,
      imported,
      skipped,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    };
  }

  // Import route must come BEFORE generic POST route
  @Post('import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(@UploadedFile() file: MulterFile) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    try {
      // Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const row of data as any[]) {
        try {
          // Support different column name formats
          const code = row['HSN Code'] || row['code'] || row['Code'] || row['HSNCode'];
          const description = row['Description'] || row['description'];
          const gstRate = parseFloat(row['GST Rate'] || row['gstRate'] || row['GSTRate'] || '18');

          if (!code || !description) {
            skipped++;
            errors.push(`Row skipped: Missing code or description`);
            continue;
          }

          // Check if already exists
          const existing = await this.hsnCodesService.findByCode(code.toString());
          if (existing) {
            // Update existing
            await this.hsnCodesService.update(existing.id, {
              description: description.toString(),
              gstRate,
            });
            imported++;
          } else {
            // Create new
            await this.hsnCodesService.create({
              code: code.toString(),
              description: description.toString(),
              gstRate,
            });
            imported++;
          }
        } catch (error) {
          skipped++;
          errors.push(`Error processing row: ${error.message}`);
        }
      }

      return {
        message: 'Import completed',
        imported,
        skipped,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      };
    } catch (error) {
      console.error('Error importing HSN codes:', error);
      throw new HttpException(
        `Failed to import HSN codes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async findAll(@Query('search') search?: string) {
    try {
      if (search) {
        return await this.hsnCodesService.search(search);
      }
      return await this.hsnCodesService.findAll();
    } catch (error) {
      console.error('Error fetching HSN codes:', error);
      throw new HttpException(
        'Failed to fetch HSN codes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':code')
  async findByCode(@Param('code') code: string) {
    try {
      const hsnCode = await this.hsnCodesService.findByCode(code);
      if (!hsnCode) {
        throw new HttpException('HSN code not found', HttpStatus.NOT_FOUND);
      }
      return hsnCode;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('Error fetching HSN code:', error);
      throw new HttpException(
        'Failed to fetch HSN code',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('seed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async seedStandardCodes() {
    try {
      const result = await this.hsnCodesService.seedStandardCodes();
      return {
        message: `Import completed: ${result.created} created, ${result.skipped} already existed`,
        ...result,
      };
    } catch (error) {
      console.error('Error seeding HSN codes:', error);
      throw new HttpException(
        `Failed to seed HSN codes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async create(@Body() createDto: CreateHsnCodeDto) {
    try {
      // Check if code already exists
      const existing = await this.hsnCodesService.findByCode(createDto.code);
      if (existing) {
        throw new HttpException(
          'HSN code already exists',
          HttpStatus.CONFLICT,
        );
      }

      return await this.hsnCodesService.create(createDto);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('Error creating HSN code:', error);
      throw new HttpException(
        'Failed to create HSN code',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async update(@Param('id') id: string, @Body() updateDto: UpdateHsnCodeDto) {
    try {
      return await this.hsnCodesService.update(id, updateDto);
    } catch (error) {
      console.error('Error updating HSN code:', error);
      throw new HttpException(
        'Failed to update HSN code',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async delete(@Param('id') id: string) {
    try {
      await this.hsnCodesService.delete(id);
      return { message: 'HSN code deleted successfully' };
    } catch (error) {
      console.error('Error deleting HSN code:', error);
      throw new HttpException(
        'Failed to delete HSN code',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
