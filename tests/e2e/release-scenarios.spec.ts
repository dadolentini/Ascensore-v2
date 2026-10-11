import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDefaultScenario } from '../../src/model/defaults';
import type { ExperimentResult, ScenarioV2 } from '../../src/model/contracts';

function variedBuilding(): ScenarioV2 {
  const s = createDefaultScenario();
  s.upperFloors = 12;
  s.cabins = [400, 480, 640, 800, 1000, 1250].map((ratedLoadKg, id) => ({ id, ratedLoadKg, maxPeople: [5, 6, 8, 10, 13, 16][id] }));
  s.physical = { ...s.physical, floorHeightM: 2.9, speedMps: 1.6, accelerationMps2: .8, doorBaseS: 4, passengerTransferS: .6 };
  s.traffic = { ...s.traffic, arrivalMeanHour: 8.5, arrivalSdMinutes: 11, departureMeanHour: 17.5, departureSdMinutes: 24, lunchDurationMinutes: 45, lunchStartHours: [12.5, 13, 13.5], internalTripsProbability: .2 };
  s.offices = Array.from({ length: 24 }, (_, i) => ({ id: `VERIFICA-${i + 1}`, floor: Math.floor(i / 2) + 1, employees: 18, lunchStartHour: [12.5, 13, 13.5][i % 3], lunchParticipation: [0, .5, 1][i % 3] }));
  s.seeds.simulation = ['4401', '4402', '4403'];
  s.fitTrainingDays = 2;
  return s;
}

function smallerBuilding(): ScenarioV2 {
  const s = createDefaultScenario();
  s.upperFloors = 8;
  s.cabins = [{ id: 0, ratedLoadKg: 640, maxPeople: 8 }, { id: 1, ratedLoadKg: 1000, maxPeople: 13 }];
  s.physical = { ...s.physical, floorHeightM: 3.6, speedMps: 2.2, accelerationMps2: 1.1, doorBaseS: 6, passengerTransferS: .9 };
  s.traffic = { ...s.traffic, arrivalMeanHour: 9.2, departureMeanHour: 17.2, lunchStartHours: [13.25] };
  s.offices = Array.from({ length: 8 }, (_, i) => ({ id: `PICCOLO-${i + 1}`, floor: i + 1, employees: 8, lunchStartHour: 13.25, lunchParticipation: .8 }));
  s.seeds.simulation = ['5101', '5102'];
  s.fitTrainingDays = 1;
  return s;
}

async function importAndRun(page: Page, scenario: ScenarioV2): Promise<ExperimentResult> {
  await page.locator('input[type="file"]').setInputFiles({ name: 'scenario-verifica.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scenario)) });
  await expect(page.getByLabel('Piani sopra terra', { exact: true })).toHaveValue(String(scenario.upperFloors));
  await expect(page.getByLabel('Numero di ascensori', { exact: true })).toHaveValue(String(scenario.cabins.length));
  await page.locator('.run-actions button[type="submit"]').click();
  await expect(page.getByText('Confronto completato. I risultati sono disponibili qui sotto.', { exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.result-card')).toHaveCount(3);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Dati completi JSON', exact: false }).click();
  const download = await pending;
  const experiment = JSON.parse(await readFile((await download.path())!, 'utf8')) as ExperimentResult;
  expect(experiment.scenario).toEqual(scenario);
  expect(experiment.results).toHaveLength(3 * scenario.seeds.simulation.length);
  for (const dataset of experiment.datasets) {
    const results = experiment.results.filter(result => result.seed === dataset.seed);
    expect(new Set(results.map(result => result.policy))).toEqual(new Set(['fifo', 'optimal', 'adaptive']));
    for (const result of results) {
      expect(result.datasetHash).toBe(dataset.datasetHash);
      expect(result.kpis.generated).toBe(dataset.requests.length);
      expect(result.kpis.generated).toBe(result.kpis.completed + result.kpis.waiting + result.kpis.onboard);
      expect(result.outcomes.map(({ pickupS: _p, finishS: _f, state: _s, assignedCarId: _c, ...request }) => request)).toEqual(dataset.requests);
      expect(result.outcomes.every(request => request.weightKg === 80 && request.origin >= 0 && request.destination >= 0 && request.origin <= scenario.upperFloors && request.destination <= scenario.upperFloors)).toBe(true);
      for (const event of result.trace ?? []) for (const car of event.carChanges) {
        const cabin = scenario.cabins.find(value => value.id === car.id)!;
        expect(car.actualWeightKg).toBe(80 * car.onboardIds.length);
        expect(car.actualWeightKg).toBeLessThanOrEqual(cabin.ratedLoadKg);
        expect(car.onboardIds.length).toBeLessThanOrEqual(cabin.maxPeople);
      }
    }
  }
  expect(experiment.results.some(result => result.trace !== null)).toBe(true);
  return experiment;
}

test('edifici differenti, capacità individuali, pause personalizzate e riesecuzione riproducibile senza reload', async ({ page }) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#simulatore');
  await page.evaluate(() => Object.assign(window, { __releaseDocument: 'stesso-documento' }));
  const first = await importAndRun(page, variedBuilding());
  expect(first.scenario.offices.reduce((sum, office) => sum + office.employees, 0)).toBe(432);
  const second = await importAndRun(page, smallerBuilding());
  expect(second.scenario.offices.reduce((sum, office) => sum + office.employees, 0)).toBe(64);
  expect(second.datasets[0].datasetHash).not.toBe(first.datasets[0].datasetHash);
  const repeated = await importAndRun(page, smallerBuilding());
  expect(repeated.datasets).toEqual(second.datasets);
  expect(repeated.results).toEqual(second.results);
  expect(await page.evaluate(() => (window as unknown as { __releaseDocument: string }).__releaseDocument)).toBe('stesso-documento');
  expect(errors).toEqual([]);
});
