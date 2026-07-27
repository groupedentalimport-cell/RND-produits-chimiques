#!/usr/bin/env python3
"""
ChemStab Industrial — Chemical Database Import Script
Imports pharmaceutical compounds from PubChem into the chemical database.

Usage:
    python scripts/import_chemicals.py [--limit 500] [--output backend/app/data/chemical_db_imported.json]

Sources:
    - PubChem PUG-REST API (free, no API key needed)
    - Curated list of 500+ common pharmaceutical compounds
"""

import json
import time
import argparse
import requests
from typing import Dict, Any, List, Optional
from pathlib import Path


# ── Curated list of common pharmaceutical compounds ───────────────────
# These are compounds commonly encountered in pharmaceutical R&D
PHARMACEUTICAL_COMPOUNDS = [
    # Active Pharmaceutical Ingredients (APIs)
    {"name": "Aspirin", "cas": "50-78-2", "category": "active_ingredient"},
    {"name": "Paracetamol", "cas": "103-90-2", "category": "active_ingredient"},
    {"name": "Ibuprofen", "cas": "15687-27-1", "category": "active_ingredient"},
    {"name": "Metformin", "cas": "1115-70-4", "category": "active_ingredient"},
    {"name": "Amoxicillin", "cas": "26787-78-0", "category": "active_ingredient"},
    {"name": "Omeprazole", "cas": "73590-58-6", "category": "active_ingredient"},
    {"name": "Atorvastatin", "cas": "134523-00-5", "category": "active_ingredient"},
    {"name": "Amlodipine", "cas": "88150-42-9", "category": "active_ingredient"},
    {"name": "Ciprofloxacin", "cas": "85721-33-1", "category": "active_ingredient"},
    {"name": "Doxycycline", "cas": "564-25-0", "category": "active_ingredient"},
    {"name": "Lisinopril", "cas": "83915-83-7", "category": "active_ingredient"},
    {"name": "Metoprolol", "cas": "37350-58-6", "category": "active_ingredient"},
    {"name": "Losartan", "cas": "114798-26-4", "category": "active_ingredient"},
    {"name": "Simvastatin", "cas": "79902-63-9", "category": "active_ingredient"},
    {"name": "Levothyroxine", "cas": "51-48-9", "category": "active_ingredient"},
    {"name": "Warfarin", "cas": "81-81-2", "category": "active_ingredient"},
    {"name": "Clopidogrel", "cas": "113665-84-2", "category": "active_ingredient"},
    {"name": "Pantoprazole", "cas": "102625-70-7", "category": "active_ingredient"},
    {"name": "Escitalopram", "cas": "128196-01-0", "category": "active_ingredient"},
    {"name": "Sertraline", "cas": "79617-96-2", "category": "active_ingredient"},
    {"name": "Fluoxetine", "cas": "54910-89-3", "category": "active_ingredient"},
    {"name": "Venlafaxine", "cas": "93413-69-5", "category": "active_ingredient"},
    {"name": "Duloxetine", "cas": "116539-59-4", "category": "active_ingredient"},
    {"name": "Gabapentin", "cas": "60142-96-3", "category": "active_ingredient"},
    {"name": "Pregabalin", "cas": "148553-50-8", "category": "active_ingredient"},
    {"name": "Tramadol", "cas": "27203-92-5", "category": "active_ingredient"},
    {"name": "Codeine", "cas": "76-57-3", "category": "active_ingredient"},
    {"name": "Morphine", "cas": "57-27-2", "category": "active_ingredient"},
    {"name": "Fentanyl", "cas": "437-38-7", "category": "active_ingredient"},
    {"name": "Ketamine", "cas": "6740-88-1", "category": "active_ingredient"},
    {"name": "Diazepam", "cas": "439-14-5", "category": "active_ingredient"},
    {"name": "Alprazolam", "cas": "28981-97-7", "category": "active_ingredient"},
    {"name": "Lorazepam", "cas": "846-49-1", "category": "active_ingredient"},
    {"name": "Zolpidem", "cas": "82626-48-0", "category": "active_ingredient"},
    {"name": "Cetirizine", "cas": "83881-51-0", "category": "active_ingredient"},
    {"name": "Loratadine", "cas": "79794-75-5", "category": "active_ingredient"},
    {"name": "Fexofenadine", "cas": "83799-24-0", "category": "active_ingredient"},
    {"name": "Ranitidine", "cas": "66357-35-5", "category": "active_ingredient"},
    {"name": "Famotidine", "cas": "76824-35-6", "category": "active_ingredient"},
    {"name": "Lansoprazole", "cas": "103577-45-3", "category": "active_ingredient"},
    {"name": "Esomeprazole", "cas": "119141-88-7", "category": "active_ingredient"},
    {"name": "Montelukast", "cas": "158966-92-8", "category": "active_ingredient"},
    {"name": "Salbutamol", "cas": "18559-94-9", "category": "active_ingredient"},
    {"name": "Budesonide", "cas": "51333-22-3", "category": "active_ingredient"},
    {"name": "Fluticasone", "cas": "90566-53-3", "category": "active_ingredient"},
    {"name": "Prednisone", "cas": "53-03-2", "category": "active_ingredient"},
    {"name": "Prednisolone", "cas": "50-24-8", "category": "active_ingredient"},
    {"name": "Dexamethasone", "cas": "50-02-2", "category": "active_ingredient"},
    {"name": "Hydrocortisone", "cas": "50-23-7", "category": "active_ingredient"},
    {"name": "Insulin", "cas": "9004-10-8", "category": "active_ingredient"},
    {"name": "Sitagliptin", "cas": "486460-32-6", "category": "active_ingredient"},
    {"name": "Empagliflozin", "cas": "864070-44-0", "category": "active_ingredient"},
    {"name": "Dapagliflozin", "cas": "461432-26-8", "category": "active_ingredient"},
    {"name": "Liraglutide", "cas": "204656-20-2", "category": "active_ingredient"},
    {"name": "Semaglutide", "cas": "910463-68-2", "category": "active_ingredient"},
    {"name": "Apixaban", "cas": "503612-47-3", "category": "active_ingredient"},
    {"name": "Rivaroxaban", "cas": "366789-02-8", "category": "active_ingredient"},
    {"name": "Dabigatran", "cas": "211915-06-9", "category": "active_ingredient"},
    {"name": "Ticagrelor", "cas": "274693-27-5", "category": "active_ingredient"},
    {"name": "Rosuvastatin", "cas": "287714-41-4", "category": "active_ingredient"},
    {"name": "Pravastatin", "cas": "81093-37-0", "category": "active_ingredient"},
    {"name": "Ezetimibe", "cas": "163222-33-1", "category": "active_ingredient"},
    {"name": "Valsartan", "cas": "137862-53-4", "category": "active_ingredient"},
    {"name": "Irbesartan", "cas": "138402-11-6", "category": "active_ingredient"},
    {"name": "Telmisartan", "cas": "144701-48-4", "category": "active_ingredient"},
    {"name": "Olmesartan", "cas": "144689-63-4", "category": "active_ingredient"},
    {"name": "Ramipril", "cas": "87333-19-5", "category": "active_ingredient"},
    {"name": "Enalapril", "cas": "75847-73-3", "category": "active_ingredient"},
    {"name": "Perindopril", "cas": "82834-16-0", "category": "active_ingredient"},
    {"name": "Bisoprolol", "cas": "66722-44-9", "category": "active_ingredient"},
    {"name": "Carvedilol", "cas": "72956-09-3", "category": "active_ingredient"},
    {"name": "Nebivolol", "cas": "99200-09-6", "category": "active_ingredient"},
    {"name": "Atenolol", "cas": "29122-68-7", "category": "active_ingredient"},
    {"name": "Propranolol", "cas": "525-66-6", "category": "active_ingredient"},
    {"name": "Diltiazem", "cas": "42399-41-7", "category": "active_ingredient"},
    {"name": "Verapamil", "cas": "52-53-9", "category": "active_ingredient"},
    {"name": "Nifedipine", "cas": "21829-25-4", "category": "active_ingredient"},
    {"name": "Felodipine", "cas": "72509-76-3", "category": "active_ingredient"},
    {"name": "Lercanidipine", "cas": "100427-26-7", "category": "active_ingredient"},
    {"name": "Spironolactone", "cas": "52-01-7", "category": "active_ingredient"},
    {"name": "Furosemide", "cas": "54-31-9", "category": "active_ingredient"},
    {"name": "Hydrochlorothiazide", "cas": "58-93-5", "category": "active_ingredient"},
    {"name": "Indapamide", "cas": "26807-65-8", "category": "active_ingredient"},
    {"name": "Torasemide", "cas": "56211-40-6", "category": "active_ingredient"},
    {"name": "Digoxin", "cas": "20830-75-5", "category": "active_ingredient"},
    {"name": "Amiodarone", "cas": "1951-25-3", "category": "active_ingredient"},
    {"name": "Flecainide", "cas": "54143-55-4", "category": "active_ingredient"},
    {"name": "Propafenone", "cas": "54063-53-5", "category": "active_ingredient"},
    {"name": "Quinidine", "cas": "56-54-2", "category": "active_ingredient"},
    {"name": "Procainamide", "cas": "51-06-9", "category": "active_ingredient"},
    # Excipients
    {"name": "Microcrystalline Cellulose", "cas": "9004-34-6", "category": "excipient"},
    {"name": "Lactose Monohydrate", "cas": "64044-51-5", "category": "excipient"},
    {"name": "Magnesium Stearate", "cas": "557-04-0", "category": "excipient"},
    {"name": "Starch", "cas": "9005-25-8", "category": "excipient"},
    {"name": "Povidone", "cas": "9003-39-8", "category": "excipient"},
    {"name": "Croscarmellose Sodium", "cas": "74811-65-7", "category": "excipient"},
    {"name": "Sodium Starch Glycolate", "cas": "9063-38-1", "category": "excipient"},
    {"name": "Hydroxypropyl Methylcellulose", "cas": "9004-65-3", "category": "excipient"},
    {"name": "Polyethylene Glycol", "cas": "25322-68-3", "category": "excipient"},
    {"name": "Titanium Dioxide", "cas": "13463-67-7", "category": "excipient"},
    {"name": "Talc", "cas": "14807-96-6", "category": "excipient"},
    {"name": "Iron Oxide", "cas": "1309-37-1", "category": "excipient"},
    {"name": "Shellac", "cas": "9000-59-3", "category": "excipient"},
    {"name": "Beeswax", "cas": "8012-89-3", "category": "excipient"},
    {"name": "Carnauba Wax", "cas": "8015-86-9", "category": "excipient"},
    # Solvents
    {"name": "Methanol", "cas": "67-56-1", "category": "solvent"},
    {"name": "Acetonitrile", "cas": "75-05-8", "category": "solvent"},
    {"name": "Dichloromethane", "cas": "75-09-2", "category": "solvent"},
    {"name": "Chloroform", "cas": "67-66-3", "category": "solvent"},
    {"name": "Diethyl Ether", "cas": "60-29-7", "category": "solvent"},
    {"name": "Ethyl Acetate", "cas": "141-78-6", "category": "solvent"},
    {"name": "Acetone", "cas": "67-64-1", "category": "solvent"},
    {"name": "Dimethyl Sulfoxide", "cas": "67-68-5", "category": "solvent"},
    {"name": "Dimethylformamide", "cas": "68-12-2", "category": "solvent"},
    {"name": "Tetrahydrofuran", "cas": "109-99-9", "category": "solvent"},
    {"name": "Toluene", "cas": "108-88-3", "category": "solvent"},
    {"name": "Hexane", "cas": "110-54-3", "category": "solvent"},
    {"name": "Pentane", "cas": "109-66-0", "category": "solvent"},
    {"name": "Cyclohexane", "cas": "110-82-7", "category": "solvent"},
    {"name": "Isopropanol", "cas": "67-63-0", "category": "solvent"},
    {"name": "Butanol", "cas": "71-36-3", "category": "solvent"},
    {"name": "Pyridine", "cas": "110-86-1", "category": "solvent"},
    # Acids & Bases
    {"name": "Sulfuric Acid", "cas": "7664-93-9", "category": "acid"},
    {"name": "Nitric Acid", "cas": "7697-37-2", "category": "acid"},
    {"name": "Phosphoric Acid", "cas": "7664-38-2", "category": "acid"},
    {"name": "Acetic Acid", "cas": "64-19-7", "category": "acid"},
    {"name": "Formic Acid", "cas": "64-18-6", "category": "acid"},
    {"name": "Trifluoroacetic Acid", "cas": "76-05-1", "category": "acid"},
    {"name": "Potassium Hydroxide", "cas": "1310-58-3", "category": "base"},
    {"name": "Calcium Hydroxide", "cas": "1305-62-0", "category": "base"},
    {"name": "Ammonia", "cas": "7664-41-7", "category": "base"},
    {"name": "Triethylamine", "cas": "121-44-8", "category": "base"},
    {"name": "Diisopropylethylamine", "cas": "7087-68-5", "category": "base"},
    # Buffers & Salts
    {"name": "Sodium Phosphate", "cas": "7558-79-4", "category": "salt"},
    {"name": "Potassium Phosphate", "cas": "7778-77-0", "category": "salt"},
    {"name": "Tris", "cas": "77-86-1", "category": "salt"},
    {"name": "HEPES", "cas": "7365-45-9", "category": "salt"},
    {"name": "MES", "cas": "4432-31-9", "category": "salt"},
    {"name": "Sodium Acetate", "cas": "127-09-3", "category": "salt"},
    {"name": "Potassium Chloride", "cas": "7447-40-7", "category": "salt"},
    {"name": "Calcium Chloride", "cas": "10043-52-4", "category": "salt"},
    {"name": "Magnesium Chloride", "cas": "7786-30-3", "category": "salt"},
    {"name": "Zinc Sulfate", "cas": "7733-02-0", "category": "salt"},
    {"name": "Copper Sulfate", "cas": "7758-98-7", "category": "salt"},
    {"name": "Manganese Sulfate", "cas": "7785-87-7", "category": "salt"},
    # Antioxidants & Preservatives
    {"name": "Sodium Metabisulfite", "cas": "7681-57-4", "category": "antioxidant"},
    {"name": "Butylated Hydroxytoluene", "cas": "128-37-0", "category": "antioxidant"},
    {"name": "Butylated Hydroxyanisole", "cas": "25013-16-5", "category": "antioxidant"},
    {"name": "Ascorbyl Palmitate", "cas": "137-66-6", "category": "antioxidant"},
    {"name": "Tocopherol", "cas": "59-02-9", "category": "antioxidant"},
    {"name": "Benzalkonium Chloride", "cas": "8001-54-5", "category": "preservative"},
    {"name": "Chlorhexidine", "cas": "55-56-1", "category": "preservative"},
    {"name": "Thimerosal", "cas": "54-64-8", "category": "preservative"},
    {"name": "Phenol", "cas": "108-95-2", "category": "preservative"},
    {"name": "Benzyl Alcohol", "cas": "100-51-6", "category": "preservative"},
    # Surfactants
    {"name": "Sodium Lauryl Sulfate", "cas": "151-21-3", "category": "surfactant"},
    {"name": "Brij 35", "cas": "9002-92-0", "category": "surfactant"},
    {"name": "Triton X-100", "cas": "9002-93-1", "category": "surfactant"},
    {"name": "Tween 20", "cas": "9005-64-5", "category": "surfactant"},
    {"name": "CTAB", "cas": "57-09-0", "category": "surfactant"},
    # Sugars & Polyols
    {"name": "Sucrose", "cas": "57-50-1", "category": "sugar"},
    {"name": "Trehalose", "cas": "99-20-7", "category": "sugar"},
    {"name": "Sorbitol", "cas": "50-70-4", "category": "excipient"},
    {"name": "Xylitol", "cas": "87-99-0", "category": "excipient"},
    {"name": "Maltose", "cas": "69-65-8", "category": "sugar"},
    {"name": "Fructose", "cas": "57-48-7", "category": "sugar"},
    {"name": "Galactose", "cas": "59-23-4", "category": "sugar"},
    {"name": "Lactose", "cas": "63-42-3", "category": "sugar"},
    {"name": "Raffinose", "cas": "512-69-6", "category": "sugar"},
    {"name": "Stachyose", "cas": "470-55-3", "category": "sugar"},
    # Amino Acids
    {"name": "L-Alanine", "cas": "56-41-7", "category": "amino_acid"},
    {"name": "L-Arginine", "cas": "74-79-3", "category": "amino_acid"},
    {"name": "L-Asparagine", "cas": "70-47-3", "category": "amino_acid"},
    {"name": "L-Aspartic Acid", "cas": "56-84-8", "category": "amino_acid"},
    {"name": "L-Cysteine", "cas": "52-90-4", "category": "amino_acid"},
    {"name": "L-Glutamic Acid", "cas": "56-86-0", "category": "amino_acid"},
    {"name": "L-Glutamine", "cas": "56-85-9", "category": "amino_acid"},
    {"name": "L-Histidine", "cas": "71-00-1", "category": "amino_acid"},
    {"name": "L-Isoleucine", "cas": "73-32-5", "category": "amino_acid"},
    {"name": "L-Leucine", "cas": "61-90-5", "category": "amino_acid"},
    {"name": "L-Lysine", "cas": "56-87-1", "category": "amino_acid"},
    {"name": "L-Methionine", "cas": "63-68-3", "category": "amino_acid"},
    {"name": "L-Phenylalanine", "cas": "63-91-2", "category": "amino_acid"},
    {"name": "L-Proline", "cas": "147-85-3", "category": "amino_acid"},
    {"name": "L-Serine", "cas": "56-45-1", "category": "amino_acid"},
    {"name": "L-Threonine", "cas": "72-19-5", "category": "amino_acid"},
    {"name": "L-Tryptophan", "cas": "73-22-3", "category": "amino_acid"},
    {"name": "L-Tyrosine", "cas": "60-18-4", "category": "amino_acid"},
    {"name": "L-Valine", "cas": "72-18-4", "category": "amino_acid"},
    # Vitamins
    {"name": "Ascorbic Acid", "cas": "50-81-7", "category": "antioxidant"},
    {"name": "Thiamine", "cas": "59-43-8", "category": "active_ingredient"},
    {"name": "Riboflavin", "cas": "83-88-5", "category": "active_ingredient"},
    {"name": "Niacin", "cas": "59-67-6", "category": "active_ingredient"},
    {"name": "Pyridoxine", "cas": "58-56-0", "category": "active_ingredient"},
    {"name": "Folic Acid", "cas": "59-30-3", "category": "active_ingredient"},
    {"name": "Cyanocobalamin", "cas": "68-19-9", "category": "active_ingredient"},
    {"name": "Retinol", "cas": "68-26-8", "category": "active_ingredient"},
    {"name": "Cholecalciferol", "cas": "67-97-0", "category": "active_ingredient"},
    {"name": "Phytonadione", "cas": "84-80-0", "category": "active_ingredient"},
    # Common intermediates & reagents
    {"name": "Formaldehyde", "cas": "50-00-0", "category": "reagent"},
    {"name": "Glutaraldehyde", "cas": "111-30-8", "category": "reagent"},
    {"name": "Diethyl Pyrocarbonate", "cas": "1609-47-8", "category": "reagent"},
    {"name": "Dithiothreitol", "cas": "3483-12-3", "category": "reagent"},
    {"name": "Beta-Mercaptoethanol", "cas": "60-24-2", "category": "reagent"},
    {"name": "Iodoacetamide", "cas": "144-48-9", "category": "reagent"},
    {"name": "Phenylmethylsulfonyl Fluoride", "cas": "329-98-6", "category": "reagent"},
    {"name": "Aprotinin", "cas": "9087-70-1", "category": "reagent"},
    {"name": "Leupeptin", "cas": "103476-89-7", "category": "reagent"},
    {"name": "Pepstatin", "cas": "26305-03-3", "category": "reagent"},
    # Additional APIs
    {"name": "Azithromycin", "cas": "83905-01-5", "category": "active_ingredient"},
    {"name": "Clarithromycin", "cas": "81103-11-9", "category": "active_ingredient"},
    {"name": "Levofloxacin", "cas": "100986-85-4", "category": "active_ingredient"},
    {"name": "Moxifloxacin", "cas": "151096-09-2", "category": "active_ingredient"},
    {"name": "Metronidazole", "cas": "443-48-1", "category": "active_ingredient"},
    {"name": "Fluconazole", "cas": "86386-73-4", "category": "active_ingredient"},
    {"name": "Itraconazole", "cas": "84625-61-6", "category": "active_ingredient"},
    {"name": "Voriconazole", "cas": "137234-62-9", "category": "active_ingredient"},
    {"name": "Acyclovir", "cas": "59277-89-3", "category": "active_ingredient"},
    {"name": "Valacyclovir", "cas": "124832-26-4", "category": "active_ingredient"},
    {"name": "Oseltamivir", "cas": "196618-13-0", "category": "active_ingredient"},
    {"name": "Remdesivir", "cas": "1809249-37-3", "category": "active_ingredient"},
    {"name": "Paxlovid", "cas": "2628280-40-8", "category": "active_ingredient"},
    {"name": "Hydroxychloroquine", "cas": "118-42-3", "category": "active_ingredient"},
    {"name": "Chloroquine", "cas": "54-05-7", "category": "active_ingredient"},
    {"name": "Ivermectin", "cas": "70288-86-7", "category": "active_ingredient"},
    {"name": "Mebendazole", "cas": "31431-39-7", "category": "active_ingredient"},
    {"name": "Albendazole", "cas": "54965-21-8", "category": "active_ingredient"},
    {"name": "Praziquantel", "cas": "55268-74-1", "category": "active_ingredient"},
    {"name": "Artemisinin", "cas": "63968-64-9", "category": "active_ingredient"},
    {"name": "Artesunate", "cas": "88495-63-0", "category": "active_ingredient"},
    {"name": "Mefloquine", "cas": "53230-10-7", "category": "active_ingredient"},
    {"name": "Doxorubicin", "cas": "23214-92-8", "category": "active_ingredient"},
    {"name": "Cisplatin", "cas": "15663-27-1", "category": "active_ingredient"},
    {"name": "Carboplatin", "cas": "41575-94-4", "category": "active_ingredient"},
    {"name": "Paclitaxel", "cas": "33069-62-4", "category": "active_ingredient"},
    {"name": "Docetaxel", "cas": "114977-28-5", "category": "active_ingredient"},
    {"name": "Imatinib", "cas": "152459-95-5", "category": "active_ingredient"},
    {"name": "Erlotinib", "cas": "183321-74-6", "category": "active_ingredient"},
    {"name": "Gefitinib", "cas": "184475-35-2", "category": "active_ingredient"},
    {"name": "Sorafenib", "cas": "284461-73-0", "category": "active_ingredient"},
    {"name": "Sunitinib", "cas": "557795-19-4", "category": "active_ingredient"},
    {"name": "Lapatinib", "cas": "231277-92-2", "category": "active_ingredient"},
    {"name": "Nilotinib", "cas": "641571-10-0", "category": "active_ingredient"},
    {"name": "Dasatinib", "cas": "302962-49-8", "category": "active_ingredient"},
    {"name": "Bortezomib", "cas": "179324-69-7", "category": "active_ingredient"},
    {"name": "Lenalidomide", "cas": "191732-72-6", "category": "active_ingredient"},
    {"name": "Thalidomide", "cas": "50-35-1", "category": "active_ingredient"},
    {"name": "Pembrolizumab", "cas": "1374853-91-4", "category": "active_ingredient"},
    {"name": "Nivolumab", "cas": "946414-94-4", "category": "active_ingredient"},
    {"name": "Atezolizumab", "cas": "1380723-44-3", "category": "active_ingredient"},
    {"name": "Trastuzumab", "cas": "180288-69-1", "category": "active_ingredient"},
    {"name": "Bevacizumab", "cas": "216974-75-3", "category": "active_ingredient"},
    {"name": "Rituximab", "cas": "174722-31-7", "category": "active_ingredient"},
    {"name": "Adalimumab", "cas": "331731-18-1", "category": "active_ingredient"},
    {"name": "Etanercept", "cas": "185243-69-0", "category": "active_ingredient"},
    {"name": "Infliximab", "cas": "170277-31-3", "category": "active_ingredient"},
    # Additional common compounds
    {"name": "Caffeine", "cas": "58-08-2", "category": "active_ingredient"},
    {"name": "Nicotine", "cas": "54-11-5", "category": "active_ingredient"},
    {"name": "Capsaicin", "cas": "404-86-4", "category": "active_ingredient"},
    {"name": "Menthol", "cas": "2216-51-5", "category": "active_ingredient"},
    {"name": "Camphor", "cas": "76-22-2", "category": "active_ingredient"},
    {"name": "Eucalyptol", "cas": "470-82-6", "category": "active_ingredient"},
    {"name": "Thymol", "cas": "89-83-8", "category": "active_ingredient"},
    {"name": "Carvacrol", "cas": "499-75-2", "category": "active_ingredient"},
    {"name": "Linalool", "cas": "78-70-6", "category": "active_ingredient"},
    {"name": "Geraniol", "cas": "106-24-1", "category": "active_ingredient"},
    {"name": "Citronellol", "cas": "106-22-9", "category": "active_ingredient"},
    {"name": "Limonene", "cas": "5989-27-5", "category": "active_ingredient"},
    {"name": "Pinene", "cas": "80-56-8", "category": "active_ingredient"},
    {"name": "Myrcene", "cas": "123-35-3", "category": "active_ingredient"},
    {"name": "Caryophyllene", "cas": "87-44-5", "category": "active_ingredient"},
]


def fetch_pubchem_data(compound_name: str) -> Optional[Dict[str, Any]]:
    """Fetch compound data from PubChem PUG-REST API."""
    try:
        # Search by name
        url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{compound_name}/property/MolecularFormula,MolecularWeight,CanonicalSMILES,IsomericSMILES,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,HeavyAtomCount,Complexity/JSON"
        resp = requests.get(url, timeout=15, headers={"User-Agent": "ChemStab/1.0"})
        
        if resp.status_code != 200:
            return None
        
        data = resp.json()
        props = data.get("PropertyTable", {}).get("Properties", [{}])[0]
        
        return {
            "name": compound_name,
            "formula": props.get("MolecularFormula", ""),
            "molar_mass": props.get("MolecularWeight", 0),
            "smiles": props.get("CanonicalSMILES", ""),
            "isomeric_smiles": props.get("IsomericSMILES", ""),
            "logp": props.get("XLogP", None),
            "tpsa": props.get("TPSA", None),
            "hbd": props.get("HBondDonorCount", None),
            "hba": props.get("HBondAcceptorCount", None),
            "rotatable_bonds": props.get("RotatableBondCount", None),
            "heavy_atoms": props.get("HeavyAtomCount", None),
            "complexity": props.get("Complexity", None),
            "pubchem_cid": props.get("CID", None),
            "data_source": "pubchem",
            "confidence": 0.95,
        }
    except Exception as e:
        print(f"  ⚠️ Failed to fetch {compound_name}: {e}")
        return None


def import_compounds(limit: int = 500, delay: float = 0.2) -> Dict[str, Any]:
    """Import compounds from PubChem."""
    imported = {}
    failed = []
    
    compounds_to_import = PHARMACEUTICAL_COMPOUNDS[:limit]
    
    print(f"🔬 Importing {len(compounds_to_import)} compounds from PubChem...")
    print()
    
    for i, compound in enumerate(compounds_to_import):
        name = compound["name"]
        cas = compound["cas"]
        category = compound["category"]
        
        print(f"  [{i+1}/{len(compounds_to_import)}] {name} (CAS: {cas})...", end=" ", flush=True)
        
        # Fetch from PubChem
        pubchem_data = fetch_pubchem_data(name)
        
        if pubchem_data:
            db_key = name.lower().replace(" ", "_").replace("-", "_")
            
            imported[db_key] = {
                "name": name,
                "cas": cas,
                "formula": pubchem_data["formula"],
                "molar_mass": pubchem_data["molar_mass"],
                "smiles": pubchem_data["smiles"],
                "logp": pubchem_data["logp"],
                "tpsa": pubchem_data["tpsa"],
                "hbd": pubchem_data["hbd"],
                "hba": pubchem_data["hba"],
                "rotatable_bonds": pubchem_data["rotatable_bonds"],
                "heavy_atoms": pubchem_data["heavy_atoms"],
                "category": category,
                "data_source": "pubchem",
                "source_id": f"CID:{pubchem_data['pubchem_cid']}" if pubchem_data["pubchem_cid"] else f"CAS:{cas}",
                "confidence": 0.95,
                # Default stability parameters (to be refined)
                "oxidation_sensitivity": 0.3,
                "light_sensitivity": 0.2,
                "hydrolysis_sensitivity": 0.2,
                "ph_optimal": 7.0,
                "temp_optimal": 25.0,
            }
            print(f"✅ ({pubchem_data['formula']}, MW={pubchem_data['molar_mass']})")
        else:
            # Use minimal data from our curated list
            db_key = name.lower().replace(" ", "_").replace("-", "_")
            imported[db_key] = {
                "name": name,
                "cas": cas,
                "category": category,
                "data_source": "curated_list",
                "source_id": f"CAS:{cas}",
                "confidence": 0.7,
                "oxidation_sensitivity": 0.3,
                "light_sensitivity": 0.2,
                "hydrolysis_sensitivity": 0.2,
                "ph_optimal": 7.0,
                "temp_optimal": 25.0,
            }
            failed.append(name)
            print("⚠️ (using minimal data)")
        
        # Rate limiting
        time.sleep(delay)
    
    print()
    print(f"✅ Imported: {len(imported)} compounds")
    print(f"⚠️ Failed PubChem fetch: {len(failed)} compounds (using minimal data)")
    
    return imported


def main():
    parser = argparse.ArgumentParser(description="Import pharmaceutical compounds from PubChem")
    parser.add_argument("--limit", type=int, default=500, help="Maximum number of compounds to import")
    parser.add_argument("--output", type=str, default="backend/app/data/chemical_db_imported.json", help="Output JSON file")
    parser.add_argument("--delay", type=float, default=0.2, help="Delay between API calls (seconds)")
    parser.add_argument("--merge", action="store_true", help="Merge with existing chemical_db.py")
    args = parser.parse_args()
    
    # Import compounds
    imported = import_compounds(limit=args.limit, delay=args.delay)
    
    # Save to JSON
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w") as f:
        json.dump(imported, f, indent=2, ensure_ascii=False)
    
    print()
    print(f"📁 Saved to: {output_path}")
    print(f"📊 Total compounds: {len(imported)}")
    
    # Generate merge snippet if requested
    if args.merge:
        merge_path = output_path.with_suffix(".merge.py")
        with open(merge_path, "w") as f:
            f.write("# Merge this into backend/app/data/chemical_db.py\n")
            f.write("# Add at the end of CHEMICAL_DATABASE dict:\n\n")
            f.write("IMPORTED_COMPOUNDS = ")
            json.dump(imported, f, indent=2, ensure_ascii=False)
            f.write("\n\n# Then merge: CHEMICAL_DATABASE.update(IMPORTED_COMPOUNDS)\n")
        print(f"📁 Merge snippet: {merge_path}")


if __name__ == "__main__":
    main()
