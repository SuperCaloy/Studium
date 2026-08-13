import type { ExtractedDocument } from "./types";

const SAMPLE_TEXT = `Chapter 1: Introduction to Cellular Biology

The cell is defined as the basic structural and functional unit of all living organisms. Every organism is composed of one or more cells. The cell theory is a fundamental principle of biology that states that all living things are composed of cells, cells are the basic units of structure and function in living things, and new cells are produced from existing cells.

Cell Theory
The cell theory was developed through the work of scientists such as Schleiden, Schwann, and Virchow. Schleiden concluded that all plants are made of cells, and Schwann concluded the same for animals. Virchow famously stated that all cells arise from pre-existing cells. This principle is crucial for understanding growth, repair, and reproduction in organisms.

Prokaryotic and Eukaryotic Cells
Cells can be classified into two main types. Prokaryotic cells lack a membrane-bound nucleus and are typically smaller and simpler in structure. Examples of prokaryotic organisms include bacteria and archaea. Eukaryotic cells possess a true nucleus that is enclosed by a nuclear membrane, along with membrane-bound organelles. Plants, animals, fungi, and protists are all composed of eukaryotic cells.

The nucleus is the control center of the eukaryotic cell and contains the genetic material, DNA. The nucleolus within the nucleus is responsible for producing ribosomal RNA. The cell membrane is a phospholipid bilayer that regulates the passage of substances in and out of the cell. The cell membrane is described as selectively permeable because it allows some molecules to pass through while blocking others.

Organelles and Their Functions
The mitochondria are often referred to as the powerhouse of the cell because they are the site of cellular respiration, where glucose and oxygen are converted into ATP, the energy currency of the cell. The ribosome is the organelle responsible for protein synthesis. Ribosomes can be found free-floating in the cytoplasm or attached to the rough endoplasmic reticulum. The rough endoplasmic reticulum is covered with ribosomes and is involved in the synthesis of proteins that are destined for secretion. The smooth endoplasmic reticulum is involved in lipid synthesis and detoxification of drugs.

The golgi apparatus is the sorting and packaging center of the cell. It modifies, sorts, and packages proteins and lipids for storage or transport out of the cell. The lysosome is the digestive organelle that contains powerful enzymes to break down cellular waste and worn-out cell parts. The vacuole is a fluid-filled sac used for storage of water, nutrients, and waste. In plant cells, the central vacuole is especially large and helps maintain turgor pressure.

The cytoskeleton is a network of protein fibers that provides structural support, maintains cell shape, and facilitates cell movement. The cytoplasm is the jelly-like substance that fills the cell and serves as the site of many cellular reactions.

Chapter 2: Photosynthesis

Photosynthesis is defined as the process by which green plants and certain other organisms transform light energy into chemical energy. Photosynthesis occurs in the chloroplast, an organelle that contains the green pigment chlorophyll. Chlorophyll is the pigment that absorbs light energy, primarily in the blue and red wavelengths of the visible spectrum.

The overall equation for photosynthesis is: six molecules of carbon dioxide plus six molecules of water, in the presence of light energy and chlorophyll, produce one molecule of glucose and six molecules of oxygen. This means that carbon dioxide is taken in and oxygen is released as a byproduct.

Photosynthesis occurs in two main stages. The light-dependent reactions occur in the thylakoid membranes of the chloroplast and require light energy to produce ATP and NADPH. During these reactions, water molecules are split, releasing oxygen gas. The light-independent reactions, also known as the Calvin cycle, occur in the stroma of the chloroplast and do not require light directly. The Calvin cycle uses the ATP and NADPH produced in the light-dependent reactions to convert carbon dioxide into glucose.

The light-dependent reactions consist of two photosystems. Photosystem II absorbs light energy first and splits water, while Photosystem I produces NADPH. The electron transport chain is a series of proteins that pass electrons and help pump hydrogen ions to create a proton gradient, which drives the production of ATP.

Chapter 3: Cellular Respiration

Cellular respiration is the process by which cells break down glucose to produce ATP. The equation for cellular respiration is essentially the reverse of photosynthesis: one molecule of glucose plus six molecules of oxygen produce six molecules of carbon dioxide, six molecules of water, and energy in the form of ATP.

Cellular respiration consists of three main stages. Glycolysis occurs in the cytoplasm and is the first stage, during which one molecule of glucose is broken down into two molecules of pyruvate, producing a small amount of ATP and NADH. Glycolysis is considered anaerobic because it does not require oxygen.

The Krebs cycle, also known as the citric acid cycle, occurs in the mitochondrial matrix. During the Krebs cycle, acetyl-CoA is broken down, releasing carbon dioxide and producing ATP, NADH, and FADH2. The electron transport chain is the final stage and occurs on the inner mitochondrial membrane. This chain uses electrons from NADH and FADH2 to pump protons and generate a large amount of ATP through oxidative phosphorylation.

When oxygen is not available, organisms may undergo fermentation. Fermentation is an anaerobic process that allows glycolysis to continue by regenerating NAD+. Lactic acid fermentation occurs in muscle cells during intense exercise, while alcoholic fermentation is carried out by yeast and produces ethanol and carbon dioxide.

Key Terms: cell, cell theory, nucleus, mitochondria, chloroplast, chlorophyll, photosynthesis, cellular respiration, glycolysis, Krebs cycle, electron transport chain, fermentation, ATP, ribosome, golgi apparatus, lysosome.`;

export function createSampleDocument(): ExtractedDocument {
  const words = SAMPLE_TEXT.split(/\s+/).length;
  return {
    id: "sample-cellular-biology",
    name: "Cell Biology - Sample Material.txt",
    format: "txt",
    sizeBytes: SAMPLE_TEXT.length,
    lineCount: SAMPLE_TEXT.split("\n").length,
    wordCount: words,
    charCount: SAMPLE_TEXT.replace(/\s/g, "").length,
    text: SAMPLE_TEXT,
    flags: [],
  };
}
