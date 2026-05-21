import {
  ParsedClaim, AllocationResult, AllocationEntry,
  CreditorSummaryItem, PropertySummaryItem,
} from '../types';

// ============================================================
// Data Preprocessing
// ============================================================

interface InternalClaim {
  creditorName: string;
  collateralName: string;
  debtAmount: number;   // per-collateral claim (from input row)
  priority: number;
}

interface InternalCollateral {
  name: string;
  value: number;
}

/**
 * Preprocess raw parsed claims:
 * - Merge duplicate (creditor, collateral) pairs: sum debt, min priority
 * - Build unique creditor and collateral lists
 * - Compute total debt per creditor (max of per-collateral claims, not sum,
 *   because the same debt may be secured by multiple collaterals)
 */
function preprocess(claims: ParsedClaim[]): {
  processedClaims: InternalClaim[];
  collaterals: Map<string, InternalCollateral>;
  creditors: Map<string, number>; // creditorName -> totalDebt
} {
  const collaterals = new Map<string, InternalCollateral>();

  // Merge rows: same creditor + same collateral → sum debt, min priority
  const merged = new Map<string, { debt: number; priority: number }>();

  for (const c of claims) {
    if (!collaterals.has(c.collateralName)) {
      collaterals.set(c.collateralName, { name: c.collateralName, value: c.collateralValue });
    }

    const key = `${c.creditorName}||${c.collateralName}`;
    const existing = merged.get(key);
    if (existing) {
      existing.debt += c.debtAmount;
      existing.priority = Math.min(existing.priority, c.priority);
    } else {
      merged.set(key, { debt: c.debtAmount, priority: c.priority });
    }
  }

  // Compute total debt per creditor: max of per-collateral claims
  const creditorDebt = new Map<string, number>();
  for (const [key, val] of merged) {
    const creditorName = key.split('||')[0];
    const current = creditorDebt.get(creditorName) || 0;
    creditorDebt.set(creditorName, Math.max(current, val.debt));
  }

  const processedClaims: InternalClaim[] = [];
  for (const [key, val] of merged) {
    const [creditorName, collateralName] = key.split('||');
    processedClaims.push({
      creditorName,
      collateralName,
      debtAmount: val.debt,
      priority: val.priority,
    });
  }

  return { processedClaims, collaterals, creditors: creditorDebt };
}

// ============================================================
// Core Allocation: Exclusive-First + Proportional Shared
// ============================================================

export function runAllocation(parsedClaims: ParsedClaim[]): AllocationResult {
  const { processedClaims, collaterals, creditors } = preprocess(parsedClaims);

  // Track remaining values
  const remainingCollateral = new Map<string, number>();
  for (const [name, col] of collaterals) {
    remainingCollateral.set(name, col.value);
  }
  const remainingDebt = new Map<string, number>();
  for (const [name, debt] of creditors) {
    remainingDebt.set(name, debt);
  }

  // Group claims by priority
  const priorityGroups = new Map<number, InternalClaim[]>();
  for (const c of processedClaims) {
    if (!priorityGroups.has(c.priority)) {
      priorityGroups.set(c.priority, []);
    }
    priorityGroups.get(c.priority)!.push(c);
  }

  const sortedPriorities = Array.from(priorityGroups.keys()).sort((a, b) => a - b);
  const allocationEntries: AllocationEntry[] = [];

  for (const priority of sortedPriorities) {
    const group = priorityGroups.get(priority)!;

    // Filter to eligible claims: creditor has remaining debt AND collateral has remaining value
    const eligible = group.filter(c => {
      const debt = remainingDebt.get(c.creditorName) || 0;
      const val = remainingCollateral.get(c.collateralName) || 0;
      return debt > 1e-12 && val > 1e-12;
    });

    if (eligible.length === 0) continue;

    // Build per-collateral creditor sets
    const collateralCreditors = new Map<string, Set<string>>();
    for (const c of eligible) {
      if (!collateralCreditors.has(c.collateralName)) {
        collateralCreditors.set(c.collateralName, new Set());
      }
      collateralCreditors.get(c.collateralName)!.add(c.creditorName);
    }

    // --- Phase 1: Exclusive collaterals (only 1 creditor at this priority) ---
    // Repeat until no more exclusive allocations possible (iterations handle
    // cases where a creditor gets capped mid-pass, turning a formerly-shared
    // collateral into an exclusive one).
    let phase1Changed = true;
    while (phase1Changed) {
      phase1Changed = false;
      for (const c of eligible) {
        const creditorsOnCollateral = collateralCreditors.get(c.collateralName);
        if (!creditorsOnCollateral || creditorsOnCollateral.size !== 1) continue;

        const creditorName = c.creditorName;
        const remainingD = remainingDebt.get(creditorName) || 0;
        const remainingC = remainingCollateral.get(c.collateralName) || 0;
        if (remainingD <= 1e-12 || remainingC <= 1e-12) continue;

        const alloc = Math.min(remainingD, remainingC);
        if (alloc <= 1e-12) continue;

        allocationEntries.push({
          creditorId: creditorName,
          creditorName,
          collateralId: c.collateralName,
          collateralName: c.collateralName,
          amount: alloc,
          priority,
        });

        remainingDebt.set(creditorName, remainingD - alloc);
        remainingCollateral.set(c.collateralName, remainingC - alloc);
        phase1Changed = true;
      }
    }

    // --- Phase 2: Shared collaterals (≥2 creditors) - proportional by original per-collateral claim ---
    // Build original per-collateral claim map: (creditorName, collateralName) -> claim amount
    const originalClaim = new Map<string, number>();
    for (const c of eligible) {
      const key = `${c.creditorName}||${c.collateralName}`;
      originalClaim.set(key, (originalClaim.get(key) || 0) + c.debtAmount);
    }

    // Collect shared collaterals that still have remaining value
    const sharedCollaterals = new Set<string>();
    for (const [colName, crSet] of collateralCreditors) {
      if (crSet.size >= 2) {
        const rv = remainingCollateral.get(colName) || 0;
        if (rv > 1e-12) sharedCollaterals.add(colName);
      }
    }

    for (const colName of sharedCollaterals) {
      let colRemaining = remainingCollateral.get(colName) || 0;
      if (colRemaining <= 1e-12) continue;

      // Get creditors that have claims on this collateral and still have remaining debt
      let activeCreditors = eligible
        .filter(c => c.collateralName === colName)
        .map(c => c.creditorName)
        .filter(name => (remainingDebt.get(name) || 0) > 1e-12);

      // Iterative proportional allocation with cap correction
      // Weight = original per-collateral claim (not reduced by exclusive consumption)
      const capped = new Set<string>();

      while (activeCreditors.length > 0 && colRemaining > 1e-12) {
        const weights = activeCreditors.map(name => {
          return originalClaim.get(`${name}||${colName}`) || 0;
        });
        const totalWeight = weights.reduce((s, w) => s + w, 0);

        if (totalWeight <= 1e-12) break;

        // Compute all shares first (using pre-iteration remainingDebt)
        const shares = activeCreditors.map((name, i) => {
          const share = colRemaining * weights[i] / totalWeight;
          const cap = remainingDebt.get(name) || 0;
          return Math.min(share, cap);
        });

        const consumed = shares.reduce((s, v) => s + v, 0);
        let anyCapped = false;
        const nextActive: string[] = [];

        // Now apply allocations and update remainingDebt
        for (let i = 0; i < activeCreditors.length; i++) {
          const name = activeCreditors[i];
          const actual = shares[i];
          if (actual <= 1e-12) continue;

          remainingDebt.set(name, (remainingDebt.get(name) || 0) - actual);

          if ((remainingDebt.get(name) || 0) < 1e-12) {
            capped.add(name);
            anyCapped = true;
          } else {
            nextActive.push(name);
          }

          allocationEntries.push({
            creditorId: name,
            creditorName: name,
            collateralId: colName,
            collateralName: colName,
            amount: actual,
            priority,
          });
        }

        colRemaining -= consumed;
        activeCreditors = nextActive;

        // If no one was capped, we're done with this collateral
        if (!anyCapped) break;
      }

      remainingCollateral.set(colName, Math.max(0, colRemaining));
    }
  }

  // Merge entries with same creditor+collateral (from different priorities)
  const mergedEntries = new Map<string, AllocationEntry>();
  for (const e of allocationEntries) {
    const key = `${e.creditorName}||${e.collateralName}`;
    const existing = mergedEntries.get(key);
    if (existing) {
      existing.amount += e.amount;
      existing.priority = Math.min(existing.priority, e.priority);
    } else {
      mergedEntries.set(key, { ...e });
    }
  }

  const entries = Array.from(mergedEntries.values());

  // Build summaries
  const creditorNames = [...creditors.keys()];
  const collateralNames = [...collaterals.keys()];

  const creditorSummary: CreditorSummaryItem[] = creditorNames.map(name => {
    const totalDebt = creditors.get(name)!;
    const totalRecovery = entries
      .filter(e => e.creditorName === name)
      .reduce((s, e) => s + e.amount, 0);
    return {
      creditorId: name,
      creditorName: name,
      totalDebt,
      totalRecovery,
      recoveryRate: totalDebt > 0 ? totalRecovery / totalDebt : 0,
      shortfall: Math.max(0, totalDebt - totalRecovery),
    };
  });

  const propertySummary: PropertySummaryItem[] = collateralNames.map(name => {
    const totalValue = collaterals.get(name)!.value;
    const totalAllocated = entries
      .filter(e => e.collateralName === name)
      .reduce((s, e) => s + e.amount, 0);
    return {
      collateralId: name,
      collateralName: name,
      totalValue,
      totalAllocated,
      remainingValue: Math.max(0, totalValue - totalAllocated),
    };
  });

  const totalDistributed = entries.reduce((s, e) => s + e.amount, 0);
  const totalCollateralValue = Array.from(collaterals.values()).reduce((s, c) => s + c.value, 0);
  const totalDebt = Array.from(creditors.values()).reduce((s, d) => s + d, 0);

  return {
    entries,
    creditorSummary,
    propertySummary,
    totalDistributed,
    totalCollateralValue,
    totalDebt,
  };
}
