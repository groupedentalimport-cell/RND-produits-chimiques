// One-off script to seed sample degradation products.
// Run with: bun run scripts/seed-degradation.ts
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const molecules = await db.molecule.findMany({ select: { id: true, name: true } })
  console.log(`Found ${molecules.length} molecules`)

  // Check if degradation products already exist
  const existing = await db.degradationProduct.count()
  if (existing > 0) {
    console.log(`Already ${existing} degradation products exist. Skipping.`)
    return
  }

  const findId = (name: string) => molecules.find(m => m.name === name)?.id

  const samples: Array<{ moleculeName: string; name: string; smiles?: string; percentage?: number; hazardLevel: string }> = [
    // Aspirin degradation
    { moleculeName: 'Aspirin', name: 'Salicylic Acid', smiles: 'C1=CC=C(C(=C1)C(=O)O)O', percentage: 65, hazardLevel: 'low' },
    { moleculeName: 'Aspirin', name: 'Acetic Acid', smiles: 'CC(=O)O', percentage: 30, hazardLevel: 'low' },
    { moleculeName: 'Aspirin', name: 'Acetylsalicylic Anhydride', smiles: 'CC(=O)OC1=CC=CC=C1C(=O)OC(=O)C', percentage: 5, hazardLevel: 'moderate' },
    // Acetaminophen degradation
    { moleculeName: 'Acetaminophen', name: 'p-Aminophenol', smiles: 'C1=CC(=CC=C1N)O', percentage: 45, hazardLevel: 'moderate' },
    { moleculeName: 'Acetaminophen', name: 'Benzoquinone Imine', smiles: 'C1=CC(=O)C=CC1=N', percentage: 25, hazardLevel: 'high' },
    { moleculeName: 'Acetaminophen', name: 'Acetamide', smiles: 'CC(=O)N', percentage: 15, hazardLevel: 'low' },
    // Caffeine degradation
    { moleculeName: 'Caffeine', name: 'Theophylline', smiles: 'CN1C=NC2=C1C(=O)NC(=O)N2', percentage: 50, hazardLevel: 'low' },
    { moleculeName: 'Caffeine', name: 'Theobromine', smiles: 'Cn1cnc2c1c(=O)[nH]c(=O)n2C', percentage: 30, hazardLevel: 'low' },
    { moleculeName: 'Caffeine', name: 'Trimethyluric Acid', smiles: 'CN1C(=O)NC(=O)C2=C1N(C)C(=O)N2C', percentage: 15, hazardLevel: 'low' },
    // Hydrogen peroxide degradation
    { moleculeName: 'Hydrogen Peroxide', name: 'Water', smiles: 'O', percentage: 50, hazardLevel: 'low' },
    { moleculeName: 'Hydrogen Peroxide', name: 'Oxygen', smiles: '[O]', percentage: 50, hazardLevel: 'low' },
    // Ibuprofen degradation
    { moleculeName: 'Ibuprofen', name: '4-Isobutylacetophenone', smiles: 'CC(=O)C1=CC=C(C=C1)CC(C)C', percentage: 40, hazardLevel: 'moderate' },
    { moleculeName: 'Ibuprofen', name: 'Ibuprofen Hydroxy Metabolite', smiles: 'CC(C)CC1=CC=C(C=C1)C(C)C(=O)O', percentage: 35, hazardLevel: 'low' },
    // Benzene degradation
    { moleculeName: 'Benzene', name: 'Phenol', smiles: 'C1=CC=C(C=C1)O', percentage: 40, hazardLevel: 'moderate' },
    { moleculeName: 'Benzene', name: 'Catechol', smiles: 'C1=CC(=C(C=C1)O)O', percentage: 25, hazardLevel: 'moderate' },
    { moleculeName: 'Benzene', name: 'Hydroquinone', smiles: 'C1=CC(=CC=C1O)O', percentage: 20, hazardLevel: 'moderate' },
  ]

  let inserted = 0
  for (const sample of samples) {
    const moleculeId = findId(sample.moleculeName)
    if (!moleculeId) {
      console.warn(`Molecule not found: ${sample.moleculeName}`)
      continue
    }
    await db.degradationProduct.create({
      data: {
        name: sample.name,
        smiles: sample.smiles ?? null,
        percentage: sample.percentage ?? null,
        hazardLevel: sample.hazardLevel,
        moleculeId,
      },
    })
    inserted++
  }

  console.log(`Inserted ${inserted} degradation products`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
