import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── POST: Seed the database with sample data ─────────────────────────
export async function POST() {
  try {
    // Check if database is already seeded
    const moleculeCount = await db.molecule.count();
    if (moleculeCount > 0) {
      return NextResponse.json(
        { error: 'Database already seeded. Cannot seed again.', currentMoleculeCount: moleculeCount },
        { status: 409 }
      );
    }

    // ── Create organization ─────────────────────────────────────────
    const org = await db.organization.create({
      data: {
        name: 'ChemStab Industrial Corp',
        slug: 'chemstab-industrial',
        isActive: true,
      },
    });

    // ── Create users ────────────────────────────────────────────────
    const users = await Promise.all([
      db.user.create({
        data: {
          email: 'dr.chen@chemstab.com',
          name: 'Dr. Wei Chen',
          role: 'org_admin',
          isActive: true,
          orgId: org.id,
        },
      }),
      db.user.create({
        data: {
          email: 'sarah.johnson@chemstab.com',
          name: 'Sarah Johnson',
          role: 'project_manager',
          isActive: true,
          orgId: org.id,
        },
      }),
      db.user.create({
        data: {
          email: 'mark.rivera@chemstab.com',
          name: 'Mark Rivera',
          role: 'analyst',
          isActive: true,
          orgId: org.id,
        },
      }),
      db.user.create({
        data: {
          email: 'emily.watson@chemstab.com',
          name: 'Emily Watson',
          role: 'analyst',
          isActive: true,
          orgId: org.id,
        },
      }),
      db.user.create({
        data: {
          email: 'james.park@chemstab.com',
          name: 'James Park',
          role: 'viewer',
          isActive: true,
          orgId: org.id,
        },
      }),
    ]);

    // ── Create molecules (10) ───────────────────────────────────────
    const moleculesData = [
      {
        name: 'Aspirin',
        casNumber: '50-78-2',
        smiles: 'CC(=O)OC1=CC=CC=C1C(=O)O',
        formula: 'C9H8O4',
        molarMass: 180.16,
        logP: 1.19,
        predictedStabilityScore: 78,
        riskLevel: 'low',
        dataSource: 'pubchem',
        description: 'Acetylsalicylic acid, a widely used analgesic and anti-inflammatory drug. Moderately stable under ambient conditions but susceptible to hydrolysis in aqueous environments.',
      },
      {
        name: 'Benzene',
        casNumber: '71-43-2',
        smiles: 'C1=CC=CC=C1',
        formula: 'C6H6',
        molarMass: 78.11,
        logP: 2.13,
        predictedStabilityScore: 45,
        riskLevel: 'high',
        dataSource: 'pubchem',
        description: 'A fundamental aromatic hydrocarbon. Known carcinogen with significant environmental and health hazards. Chemically stable but poses severe toxicological risks.',
      },
      {
        name: 'Caffeine',
        casNumber: '58-08-2',
        smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',
        formula: 'C8H10N4O2',
        molarMass: 194.19,
        logP: -0.07,
        predictedStabilityScore: 92,
        riskLevel: 'low',
        dataSource: 'pubchem',
        description: 'A methylxanthine stimulant. Highly stable under normal storage conditions. Resistant to hydrolysis, oxidation, and photolysis. Excellent shelf life characteristics.',
      },
      {
        name: 'Acetaminophen',
        casNumber: '103-90-2',
        smiles: 'CC(=O)NC1=CC=C(O)C=C1',
        formula: 'C8H9NO2',
        molarMass: 151.16,
        logP: 0.46,
        predictedStabilityScore: 72,
        riskLevel: 'moderate',
        dataSource: 'pubchem',
        description: 'Paracetamol, a common analgesic. Moderate stability with susceptibility to hydrolysis at elevated pH and photolytic degradation when exposed to UV light.',
      },
      {
        name: 'Ibuprofen',
        casNumber: '15687-27-1',
        smiles: 'CC(C)CC1=CC=C(C=C1)C(C)C(=O)O',
        formula: 'C13H18O2',
        molarMass: 206.28,
        logP: 3.97,
        predictedStabilityScore: 85,
        riskLevel: 'low',
        dataSource: 'pubchem',
        description: 'A propionic acid derivative NSAID. Good stability profile under standard storage conditions. Slight hydrolysis risk in aqueous formulations.',
      },
      {
        name: 'Ethanol',
        casNumber: '64-17-5',
        smiles: 'CCO',
        formula: 'C2H6O',
        molarMass: 46.07,
        logP: -0.31,
        predictedStabilityScore: 88,
        riskLevel: 'low',
        dataSource: 'manual',
        description: 'Simple alcohol widely used as solvent and preservative. Very stable in sealed containers. Volatile — evaporation loss is the primary concern.',
      },
      {
        name: 'Methanol',
        casNumber: '67-56-1',
        smiles: 'CO',
        formula: 'CH4O',
        molarMass: 32.04,
        logP: -0.74,
        predictedStabilityScore: 82,
        riskLevel: 'moderate',
        dataSource: 'manual',
        description: 'Simple alcohol with high toxicity. Chemically stable but extremely hazardous upon ingestion or inhalation. Requires strict handling protocols.',
      },
      {
        name: 'Sodium Chloride',
        casNumber: '7647-14-5',
        smiles: '[Na+].[Cl-]',
        formula: 'NaCl',
        molarMass: 58.44,
        logP: -4.2,
        predictedStabilityScore: 98,
        riskLevel: 'low',
        dataSource: 'manual',
        description: 'Common salt. Exceptionally stable under all conditions. No significant degradation pathways. The benchmark for chemical stability.',
      },
      {
        name: 'Acetic Acid',
        casNumber: '64-19-7',
        smiles: 'CC(=O)O',
        formula: 'C2H4O2',
        molarMass: 60.05,
        logP: -0.17,
        predictedStabilityScore: 75,
        riskLevel: 'low',
        dataSource: 'manual',
        description: 'A simple carboxylic acid. Stable under normal conditions. Corrosive at high concentrations. Volatile with characteristic pungent odor.',
      },
      {
        name: 'Hydrogen Peroxide',
        casNumber: '7722-84-1',
        smiles: 'OO',
        formula: 'H2O2',
        molarMass: 34.01,
        logP: -0.5,
        predictedStabilityScore: 35,
        riskLevel: 'critical',
        dataSource: 'manual',
        description: 'A strong oxidizer with limited shelf life. Decomposes rapidly in presence of light, heat, and contaminants. Requires stabilizers and cool storage.',
      },
    ];

    const molecules = await Promise.all(
      moleculesData.map((m) =>
        db.molecule.create({
          data: {
            ...m,
            orgId: org.id,
          },
        })
      )
    );

    // ── Create studies (5) ──────────────────────────────────────────
    const studiesData = [
      {
        studyCode: 'STB-2024-001',
        substanceName: 'Aspirin',
        studyType: 'long_term',
        temperatureC: 25,
        humidityPercent: 60,
        durationMonths: 24,
        predictedShelfLifeMonths: 36,
        status: 'in_progress',
        moleculeId: molecules[0].id,
        orgId: org.id,
      },
      {
        studyCode: 'STB-2024-002',
        substanceName: 'Caffeine',
        studyType: 'accelerated',
        temperatureC: 40,
        humidityPercent: 75,
        durationMonths: 6,
        predictedShelfLifeMonths: 60,
        status: 'completed',
        moleculeId: molecules[2].id,
        orgId: org.id,
      },
      {
        studyCode: 'STB-2024-003',
        substanceName: 'Acetaminophen',
        studyType: 'stress',
        temperatureC: 60,
        humidityPercent: 80,
        durationMonths: 3,
        predictedShelfLifeMonths: 18,
        status: 'under_review',
        moleculeId: molecules[3].id,
        orgId: org.id,
      },
      {
        studyCode: 'STB-2024-004',
        substanceName: 'Hydrogen Peroxide',
        studyType: 'intermediate',
        temperatureC: 30,
        humidityPercent: 65,
        durationMonths: 12,
        predictedShelfLifeMonths: 6,
        status: 'draft',
        moleculeId: molecules[9].id,
        orgId: org.id,
      },
      {
        studyCode: 'STB-2024-005',
        substanceName: 'Ibuprofen',
        studyType: 'long_term',
        temperatureC: 25,
        humidityPercent: 60,
        durationMonths: 36,
        predictedShelfLifeMonths: 48,
        status: 'approved',
        moleculeId: molecules[4].id,
        orgId: org.id,
      },
    ];

    const studies = await Promise.all(
      studiesData.map((s) => db.stabilityStudy.create({ data: s }))
    );

    // ── Create audit log entries (6) ─────────────────────────────────
    const auditLogs = await Promise.all([
      db.auditLog.create({
        data: {
          action: 'create',
          tableName: 'Molecule',
          recordId: molecules[0].id,
          details: 'Created molecule record: Aspirin (CAS 50-78-2)',
          userId: users[0].id,
        },
      }),
      db.auditLog.create({
        data: {
          action: 'create',
          tableName: 'StabilityStudy',
          recordId: studies[0].id,
          details: 'Created study STB-2024-001 for Aspirin long-term stability',
          userId: users[1].id,
        },
      }),
      db.auditLog.create({
        data: {
          action: 'approve',
          tableName: 'StabilityStudy',
          recordId: studies[4].id,
          details: 'Approved study STB-2024-005 for Ibuprofen',
          userId: users[2].id,
        },
      }),
      db.auditLog.create({
        data: {
          action: 'update',
          tableName: 'StabilityStudy',
          recordId: studies[1].id,
          details: 'Status changed from in_progress to completed for STB-2024-002',
          userId: users[3].id,
        },
      }),
      db.auditLog.create({
        data: {
          action: 'sign',
          tableName: 'ElectronicSignature',
          recordId: studies[4].id,
          details: 'Electronic signature applied by Dr. Wei Chen for study approval',
          userId: users[0].id,
        },
      }),
      db.auditLog.create({
        data: {
          action: 'create',
          tableName: 'Report',
          recordId: 'placeholder',
          details: 'Generated ICH Q1A compliance report for STB-2024-005',
          userId: users[1].id,
        },
      }),
    ]);

    // ── Create reports (5) ──────────────────────────────────────────
    const reports = await Promise.all([
      db.report.create({
        data: {
          title: 'ICH Q1A Stability Report — Ibuprofen Long-Term Study',
          reportType: 'ich_q1a',
          status: 'approved',
          studyId: studies[4].id,
        },
      }),
      db.report.create({
        data: {
          title: 'CTD Module 3.2.P.8.3 — Caffeine Accelerated Study',
          reportType: 'ctd_module',
          status: 'completed',
          studyId: studies[1].id,
        },
      }),
      db.report.create({
        data: {
          title: 'FMEA Risk Assessment — Acetaminophen Formulation',
          reportType: 'fmea',
          status: 'draft',
          studyId: studies[2].id,
        },
      }),
      db.report.create({
        data: {
          title: 'DoE Optimization Report — Aspirin Tablet Stability',
          reportType: 'doe',
          status: 'in_review',
          studyId: studies[0].id,
        },
      }),
      db.report.create({
        data: {
          title: 'Validation Protocol — Hydrogen Peroxide Storage',
          reportType: 'validation_protocol',
          status: 'draft',
          studyId: studies[3].id,
        },
      }),
    ]);

    // ── Create time points for completed study (STB-2024-002) ────────
    const timePoints = await Promise.all([
      db.timePoint.create({
        data: {
          timeDays: 0,
          timeMonths: 0,
          concentration: 100,
          percentRemaining: 100,
          degradationPercent: 0,
          studyId: studies[1].id,
        },
      }),
      db.timePoint.create({
        data: {
          timeDays: 30,
          timeMonths: 1,
          concentration: 98.5,
          percentRemaining: 98.5,
          degradationPercent: 1.5,
          studyId: studies[1].id,
        },
      }),
      db.timePoint.create({
        data: {
          timeDays: 90,
          timeMonths: 3,
          concentration: 97.2,
          percentRemaining: 97.2,
          degradationPercent: 2.8,
          studyId: studies[1].id,
        },
      }),
      db.timePoint.create({
        data: {
          timeDays: 180,
          timeMonths: 6,
          concentration: 95.8,
          percentRemaining: 95.8,
          degradationPercent: 4.2,
          studyId: studies[1].id,
        },
      }),
    ]);

    // ── Create electronic signature for approved study ───────────────
    const signature = await db.electronicSignature.create({
      data: {
        signerName: 'Dr. Wei Chen',
        signerRole: 'org_admin',
        meaning: 'Reviewed and Approved',
        signatureHash: 'sha256:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
        studyId: studies[4].id,
      },
    });

    // ── Create compliance reports ────────────────────────────────────────
    const complianceReports = await Promise.all([
      db.complianceReport.create({
        data: {
          studyId: studies[4].id,
          studyCode: 'STB-2024-005',
          substanceName: 'Ibuprofen',
          overallScore: 92,
          passCount: 8,
          warningCount: 1,
          failCount: 0,
          notApplicableCount: 1,
          readyForSubmission: true,
          categoryScores: JSON.stringify([
            { category: 'ICH Q1A Conditions', score: 95, status: 'pass' },
            { category: 'Storage Conditions', score: 90, status: 'pass' },
            { category: 'Analytical Methods', score: 88, status: 'pass' },
            { category: 'Data Integrity', score: 92, status: 'pass' },
            { category: 'Documentation', score: 85, status: 'warning' },
          ]),
          blockingIssues: JSON.stringify([]),
          checkedBy: users[0].name || 'system',
        },
      }),
      db.complianceReport.create({
        data: {
          studyId: studies[1].id,
          studyCode: 'STB-2024-002',
          substanceName: 'Caffeine',
          overallScore: 78,
          passCount: 6,
          warningCount: 2,
          failCount: 1,
          notApplicableCount: 1,
          readyForSubmission: false,
          categoryScores: JSON.stringify([
            { category: 'ICH Q1A Conditions', score: 82, status: 'pass' },
            { category: 'Storage Conditions', score: 75, status: 'warning' },
            { category: 'Analytical Methods', score: 80, status: 'pass' },
            { category: 'Data Integrity', score: 70, status: 'warning' },
            { category: 'Documentation', score: 60, status: 'fail' },
          ]),
          blockingIssues: JSON.stringify(['Documentation incomplete for accelerated study protocol']),
          checkedBy: users[2].name || 'system',
        },
      }),
    ]);

    // ── Create degradation products (with percentage + hazardLevel) ───────
    const degradationProducts = await Promise.all([
      // Aspirin → Salicylic Acid (Hydrolysis) + Acetic Acid (Hydrolysis)
      db.degradationProduct.create({
        data: {
          name: 'Salicylic Acid',
          smiles: 'OC1=CC=CC=C1C(=O)O',
          percentage: 65,
          hazardLevel: 'moderate',
          moleculeId: molecules[0].id, // Aspirin
        },
      }),
      db.degradationProduct.create({
        data: {
          name: 'Acetic Acid',
          smiles: 'CC(=O)O',
          percentage: 35,
          hazardLevel: 'low',
          moleculeId: molecules[0].id, // Aspirin
        },
      }),
      // Ibuprofen → Hydroxyibuprofen (Oxidation) + Isobutylphenol (Thermal)
      db.degradationProduct.create({
        data: {
          name: 'Hydroxyibuprofen',
          smiles: 'CC(C)CC1=CC=C(C=C1)C(O)(C)C(=O)O',
          percentage: 42,
          hazardLevel: 'low',
          moleculeId: molecules[4].id, // Ibuprofen
        },
      }),
      db.degradationProduct.create({
        data: {
          name: 'Isobutylphenol',
          smiles: 'CC(C)CC1=CC=C(O)C=C1',
          percentage: 18,
          hazardLevel: 'moderate',
          moleculeId: molecules[4].id, // Ibuprofen
        },
      }),
      // Acetaminophen → NAPQI (Oxidation) + p-Aminophenol (Hydrolysis)
      db.degradationProduct.create({
        data: {
          name: 'NAPQI',
          smiles: 'CC(=O)N=C1C=CC(=O)C=C1',
          percentage: 12,
          hazardLevel: 'high',
          moleculeId: molecules[3].id, // Acetaminophen
        },
      }),
      db.degradationProduct.create({
        data: {
          name: 'p-Aminophenol',
          smiles: 'NC1=CC=C(O)C=C1',
          percentage: 28,
          hazardLevel: 'moderate',
          moleculeId: molecules[3].id, // Acetaminophen
        },
      }),
      // H₂O₂ → Water (Photolysis) + Oxygen (Photolysis)
      db.degradationProduct.create({
        data: {
          name: 'Water',
          smiles: 'O',
          percentage: 50,
          hazardLevel: 'low',
          moleculeId: molecules[9].id, // Hydrogen Peroxide
        },
      }),
      db.degradationProduct.create({
        data: {
          name: 'Oxygen',
          smiles: 'O=O',
          percentage: 50,
          hazardLevel: 'low',
          moleculeId: molecules[9].id, // Hydrogen Peroxide
        },
      }),
      // Caffeine → Dimethylparabanic Acid (Photolysis)
      db.degradationProduct.create({
        data: {
          name: 'Dimethylparabanic Acid',
          smiles: 'CN1C(=O)N(C)C(=O)C1=O',
          percentage: 22,
          hazardLevel: 'moderate',
          moleculeId: molecules[2].id, // Caffeine
        },
      }),
    ]);

    // ── Create drug interactions (10 curated interactions) ────────────────
    const drugInteractions = await Promise.all([
      db.drugInteraction.create({
        data: {
          substanceA: 'Aspirin',
          substanceB: 'Ibuprofen',
          severity: 'major',
          mechanism: 'Ibuprofen competitively inhibits aspirin binding to platelet COX-1, reducing aspirin\'s antiplatelet cardioprotective effect.',
          clinicalEffect: 'Reduced antiplatelet efficacy of aspirin; increased cardiovascular risk in patients taking aspirin for secondary prevention.',
          onset: 'rapid',
          management: 'Take aspirin at least 30 minutes before ibuprofen, or use an alternative NSAID (e.g., naproxen). Consider paracetamol for analgesia.',
          evidenceLevel: 'established',
          literatureRef: 'FDA Drug Safety Communication (2014)',
        },
      }),
      db.drugInteraction.create({
        data: {
          substanceA: 'Aspirin',
          substanceB: 'Acetaminophen',
          severity: 'minor',
          mechanism: 'No significant pharmacokinetic interaction. Both can be used together for synergistic analgesic/antipyretic effects.',
          clinicalEffect: 'Generally safe combination; additive antipyretic effect.',
          onset: 'not_specified',
          management: 'No dose adjustment required. Monitor for gastric irritation with prolonged use.',
          evidenceLevel: 'established',
        },
      }),
      db.drugInteraction.create({
        data: {
          substanceA: 'Ibuprofen',
          substanceB: 'Caffeine',
          severity: 'moderate',
          mechanism: 'Caffeine may enhance the analgesic effect of ibuprofen but can also increase GI irritation risk.',
          clinicalEffect: 'Enhanced analgesia; potential for increased gastric acid secretion.',
          onset: 'rapid',
          management: 'Generally safe at standard OTC doses. Take with food to reduce GI irritation.',
          evidenceLevel: 'probable',
        },
      }),
      db.drugInteraction.create({
        data: {
          substanceA: 'Aspirin',
          substanceB: 'Hydrogen Peroxide',
          severity: 'contraindicated',
          mechanism: 'Aspirin (acetylsalicylic acid) undergoes oxidative degradation in the presence of strong oxidizers like H₂O₂, producing toxic salicylic acid derivatives and oxygen gas.',
          clinicalEffect: 'Chemical incompatibility — formulation instability, potential for container rupture from gas evolution.',
          onset: 'rapid',
          management: 'Never co-formulate or co-administer. Store separately. Use antioxidant packaging if both must be in the same facility.',
          evidenceLevel: 'established',
          literatureRef: 'USP <1074> Stability Considerations',
        },
      }),
      db.drugInteraction.create({
        data: {
          substanceA: 'Caffeine',
          substanceB: 'Acetaminophen',
          severity: 'minor',
          mechanism: 'Caffeine enhances absorption rate of acetaminophen; common fixed-dose combination products exist.',
          clinicalEffect: 'Faster onset of analgesia; no clinically significant safety concern at therapeutic doses.',
          onset: 'rapid',
          management: 'Safe combination. Many OTC products combine these. Monitor total daily caffeine intake.',
          evidenceLevel: 'established',
        },
      }),
      db.drugInteraction.create({
        data: {
          substanceA: 'Acetaminophen',
          substanceB: 'Hydrogen Peroxide',
          severity: 'major',
          mechanism: 'H₂O₂ oxidizes the amide bond in acetaminophen, producing N-acetyl-p-benzoquinone imine (NAPQI) — a hepatotoxic metabolite.',
          clinicalEffect: 'Increased risk of hepatotoxicity; chemical incompatibility in formulation.',
          onset: 'delayed',
          management: 'Avoid co-formulation. Ensure no oxidizing residue in manufacturing equipment. Monitor liver enzymes if co-administered.',
          evidenceLevel: 'established',
          literatureRef: 'Mitchell et al., J Pharmacol Exp Ther (1973)',
        },
      }),
      db.drugInteraction.create({
        data: {
          substanceA: 'Ibuprofen',
          substanceB: 'Acetaminophen',
          severity: 'minor',
          mechanism: 'No significant pharmacokinetic interaction. Different mechanisms of action (COX inhibition vs. central COX/serotonin).',
          clinicalEffect: 'Additive or synergistic analgesia; commonly alternated in pediatric fever management.',
          onset: 'not_specified',
          management: 'Safe combination at therapeutic doses. Useful for multimodal analgesia.',
          evidenceLevel: 'established',
        },
      }),
      db.drugInteraction.create({
        data: {
          substanceA: 'Aspirin',
          substanceB: 'Caffeine',
          severity: 'moderate',
          mechanism: 'Caffeine may increase aspirin absorption rate and enhance analgesic effect; can increase gastric irritation.',
          clinicalEffect: 'Enhanced analgesia; potential increased GI side effects.',
          onset: 'rapid',
          management: 'Common in OTC combination products. Take with food. Monitor for GI symptoms.',
          evidenceLevel: 'established',
        },
      }),
      db.drugInteraction.create({
        data: {
          substanceA: 'Formaldehyde',
          substanceB: 'Aspirin',
          severity: 'major',
          mechanism: 'Formaldehyde can react with aspirin\'s carboxyl group, forming unstable adducts and accelerating hydrolysis.',
          clinicalEffect: 'Formulation instability; potential for toxic byproduct formation.',
          onset: 'delayed',
          management: 'Avoid co-formulation. Ensure formaldehyde-free manufacturing environments. Test for residual formaldehyde in excipients.',
          evidenceLevel: 'probable',
        },
      }),
      db.drugInteraction.create({
        data: {
          substanceA: 'Ethanol',
          substanceB: 'Acetaminophen',
          severity: 'major',
          mechanism: 'Ethanol induces CYP2E1, increasing conversion of acetaminophen to NAPQI hepatotoxic metabolite.',
          clinicalEffect: 'Increased risk of severe hepatotoxicity, especially with chronic alcohol use or overdose.',
          onset: 'delayed',
          management: 'Patients consuming ≥3 alcoholic drinks daily should avoid acetaminophen or limit to ≤2 g/day. Warn patients about OTC products containing acetaminophen.',
          evidenceLevel: 'established',
          literatureRef: 'FDA Hepatotoxicity Warning Label (2011)',
        },
      }),
    ]);

    // ── Create notifications (real DB-driven) ────────────────────────────────
    const notificationsData = [
      {
        title: 'Critical stability risk detected',
        message: 'Hydrogen Peroxide (H₂O₂) accelerated study shows 38% degradation at day 30 — exceeds OOS threshold. Immediate review required.',
        category: 'alert',
        severity: 'critical',
        read: false,
        actionLabel: 'View Study',
        actionPage: 'studies',
      },
      {
        title: 'Study STB-2024-001 completed',
        message: 'Aspirin long-term stability study (24 months) has finished data collection. Predicted shelf life: 36 months.',
        category: 'study',
        severity: 'success',
        read: false,
        actionLabel: 'View Study',
        actionPage: 'studies',
      },
      {
        title: 'New molecule added to library',
        message: 'Formaldehyde (CH₂O) was added by Dr. Sarah Chen. Risk level set to High — review recommended.',
        category: 'molecule',
        severity: 'info',
        read: false,
        actionLabel: 'View Molecules',
        actionPage: 'molecules',
      },
      {
        title: 'Report ready for review',
        message: 'ICH Q1A — Aspirin Long-Term Stability report has been generated and is awaiting your review before submission.',
        category: 'report',
        severity: 'info',
        read: false,
        actionLabel: 'Open Reports',
        actionPage: 'reports',
      },
      {
        title: 'Low disk space warning',
        message: 'Stability chamber data partition is at 87% capacity. Consider archiving completed studies older than 12 months.',
        category: 'system',
        severity: 'warning',
        read: false,
        actionLabel: 'System Admin',
        actionPage: 'admin',
      },
      {
        title: 'Study signed electronically',
        message: 'Dr. Elena Volkov signed STB-2024-005 (H₂O₂ accelerated study). Signature hash recorded per FDA 21 CFR Part 11.',
        category: 'study',
        severity: 'success',
        read: true,
      },
      {
        title: 'FMEA report approved',
        message: 'FMEA Risk Assessment for H₂O₂ has been approved and is now ready for regulatory submission.',
        category: 'report',
        severity: 'success',
        read: true,
        actionLabel: 'Open Reports',
        actionPage: 'reports',
      },
      {
        title: 'Audit log threshold reached',
        message: '5000+ audit log entries recorded this quarter. Consider exporting the audit trail for long-term archival.',
        category: 'system',
        severity: 'info',
        read: true,
        actionLabel: 'View Audit',
        actionPage: 'admin',
      },
      {
        title: 'Caffeine shelf life extended',
        message: 'Intermediate study confirmed Caffeine stability at 30°C — predicted shelf life extended from 48 to 60 months.',
        category: 'study',
        severity: 'success',
        read: true,
      },
      {
        title: 'Scheduled maintenance tonight',
        message: 'Stability Chamber SC-04 will undergo IQ/OQ/PQ re-validation tonight 02:00–04:00 UTC. Plan study readings accordingly.',
        category: 'system',
        severity: 'warning',
        read: true,
      },
    ];

    const notifications = await Promise.all(
      notificationsData.map((n) =>
        db.notification.create({ data: { ...n, userId: 'system' } })
      )
    );

    return NextResponse.json({
      message: 'Database seeded successfully',
      data: {
        organization: 1,
        users: users.length,
        molecules: molecules.length,
        studies: studies.length,
        auditLogs: auditLogs.length,
        reports: reports.length,
        timePoints: timePoints.length,
        signatures: 1,
        complianceReports: complianceReports.length,
        degradationProducts: degradationProducts.length,
        drugInteractions: drugInteractions.length,
        notifications: notifications.length,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/seed error:', error);
    return NextResponse.json(
      { error: 'Failed to seed database', details: String(error) },
      { status: 500 }
    );
  }
}
