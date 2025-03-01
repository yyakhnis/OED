/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/*
	This file tests the readings retrieval API.

	see: https://github.com/OpenEnergyDashboard/DevDocs/blob/main/testing/testing.md for information on loading readings test data

	Directions for creating reading tests (not needed for rejection tests)
		1) define arrays of data for units, conversions, a test meter using testing csv (optionally a second test meter and group for group testing)
		2) load these arrays by invoking prepareTest(* defined data arrays *)
		3) create an array of values using the expected values csv by calling parseExpectedCsv on the file and assigning the return value
		4) write your test using expectReadingToEqualExpected to check the values and createTimeString
*/





const { chai, mocha, expect, app, testDB } = require('../common');
const { TimeInterval } = require('../../../common/TimeInterval');
const { insertUnits, insertConversions, insertMeters, insertGroups } = require('../../util/insertData');
const Unit = require('../../models/Unit');
const { redoCik } = require('../../services/graph/redoCik');
const { refreshAllReadingViews } = require('../../services/refreshAllReadingViews');
const readCsv = require('../../services/pipeline-in-progress/readCsv');
const moment = require('moment');

const {prepareTest,
	parseExpectedCsv,
	expectThreeDReadingToEqualExpected,
	createTimeString,
	getUnitId,
	ETERNITY,
	METER_ID,
	GROUP_ID,
	HTTP_CODE,
    unitDatakWh,
    conversionDatakWh} = require('./readingsUtils');

// TODO
// Test readings from meters at different rates (15 min, 23 min)
// Test some more date ranges as specified in DevDocs/testing/testing.md
// Test bar charts
// Test groups

mocha.describe('readings API', () => {
	mocha.describe('readings test, test if data returned by API is as expected', () => {
		mocha.describe('for threeD graphs', () => {
			mocha.describe('for meters', () => {
				// A reading response should have xData, yData, and zData properties
				mocha.it('response should have valid reading and timestamps,', async () => {
					// Create 2D array for meter to feed into the database
					// Note the meter ID is set so we know what to expect when a query is made.
					const meterData = [
						{
							name: 'Electric Utility kWh',
							unit: 'Electric_Utility',
							defaultGraphicUnit: 'kWh',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];
					// Load the data into the database
					await prepareTest(unitDatakWh, conversionDatakWh, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('kWh');
					// Create a request to the API and save the response
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: ETERNITY.toString(), graphicUnitId: unitId, sequenceNumber: 1});
					// unitReadings should return as json
					
					expect(res).to.be.json;
					// the route should not return a bad request
					expect(res).to.have.status(HTTP_CODE.OK);
					// Check if the first element returned by the API is the correct format
					expect(res.body).to.have.property('xData');
                    expect(res.body).to.have.property('yData');
                    expect(res.body).to.have.property('zData');
				});
				// Test using a date range of infinity, which should return as days
				mocha.it('should have daily points for 15 minute reading intervals and quantity units with +-inf start/end time & kWh as kWh', async () => {
					// Create 2D array for meter to feed into the database
					// Note the meter ID is set so we know what to expect when a query is made.
					const meterData = [
						{
							name: 'Electric Utility kWh',
							unit: 'Electric_Utility',
							defaultGraphicUnit: 'kWh',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];
					// Load the data into the database
					await prepareTest(unitDatakWh, conversionDatakWh, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('kWh');
					// Load the expected response data from the corresponding csv file
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_kWh_gu_kWh_st_-inf_et_inf.csv');
					// file has daily readings
					const readingsPerDay = 1;
					// Create a request to the API for unbounded reading times and save the response
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
					.query({ timeInterval: ETERNITY.toString(), graphicUnitId: unitId, sequenceNumber: 1});
					// Check that the API reading is equal to what it is expected to equal
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay);
				});
				// This test is effectively the same as the last, but we specify the date range
				// Should return daily point readings
				mocha.it('should have daily points for 15 minute reading intervals and quantity units with explicit start/end time & kWh as kWh', async () => {
					// Create 2D array for meter to feed into the database
					// Note the meter ID is set so we know what to expect when a query is made.
					const meterData = [
						{
							name: 'Electric Utility kWh',
							unit: 'Electric_Utility',
							defaultGraphicUnit: 'kWh',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];
					// Load the data into the database
					await prepareTest(unitDatakWh, conversionDatakWh, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('kWh');
					// Load and parse the corresponding expected values from csv
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_kWh_gu_kWh_st_2022-08-18%00#00#00_et_2022-11-01%00#00#00.csv');
					// file has daily readings
					const readingsPerDay = 1;
					// Create a request to the API for the date range specified using createTimeString and save the response
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: createTimeString('2022-08-18', '00:00:00', '2022-11-01', '00:00:00'), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay);
				});
				// This date range is on the threshold of returning daily point readings, 61 days
				mocha.it('should have daily points for middle readings of 15 minute for a 61 day period and quantity units with kWh as kWh', async () => {
					// Create 2D array for meter to feed into the database
					// Note the meter ID is set so we know what to expect when a query is made.
					const meterData = [
						{
							name: 'Electric Utility kWh',
							unit: 'Electric_Utility',
							defaultGraphicUnit: 'kWh',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];
					// Load the data into the database
					await prepareTest(unitDatakWh, conversionDatakWh, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('kWh');
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_kWh_gu_kWh_st_2022-08-25%00#00#00_et_2022-10-25%00#00#00.csv');
					// file has daily readings
					const readingsPerDay = 1;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: createTimeString('2022-08-25', '00:00:00', '2022-10-25', '00:00:00'), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay);
				});
				// 60 days gives hourly points & middle readings
				mocha.it('should have hourly points for middle readings of 15 minute for a 60 day period and quantity units with kWh as kWh', async () => {
					// Create 2D array for meter to feed into the database
					// Note the meter ID is set so we know what to expect when a query is made.
					const meterData = [
						{
							name: 'Electric Utility kWh',
							unit: 'Electric_Utility',
							defaultGraphicUnit: 'kWh',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];
					// Load the data into the database
					await prepareTest(unitDatakWh, conversionDatakWh, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('kWh');
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_kWh_gu_kWh_st_2022-08-25%00#00#00_et_2022-10-24%00#00#00.csv');
					// file has hourly readings
					const readingsPerDay = 24;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: createTimeString('2022-08-25', '00:00:00', '2022-10-24', '00:00:00'), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay);
				});

				mocha.it('should barely have hourly points for middle readings of 15 minute for a 15 day + 15 min period and quantity units with kWh as kWh', async () => {
					// Create 2D array for meter to feed into the database
					// Note the meter ID is set so we know what to expect when a query is made.
					const meterData = [
						{
							name: 'Electric Utility kWh',
							unit: 'Electric_Utility',
							defaultGraphicUnit: 'kWh',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];
					// Load the data into the database
					await prepareTest(unitDatakWh, conversionDatakWh, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('kWh');
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_kWh_gu_kWh_st_2022-09-21%00#00#00_et_2022-10-06%00#00#00.csv');
					// file has hourly readings
					const readingsPerDay = 24;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: createTimeString('2022-09-21', '00:00:00', '2022-10-06', '00:15:00'), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay);
				});
				// 14 days barely gives raw points & middle readings
				mocha.it('14 days barely gives raw points & middle readings', async () => {
					// Create 2D array for meter to feed into the database
					// Note the meter ID is set so we know what to expect when a query is made.
					const meterData = [
						{
							name: 'Electric Utility kWh',
							unit: 'Electric_Utility',
							defaultGraphicUnit: 'kWh',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];
					// Load the data into the database
					await prepareTest(unitDatakWh, conversionDatakWh, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('kWh');
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_kWh_gu_kWh_st_2022-09-21%00#00#00_et_2022-10-05%00#00#00.csv');
					// file has hourly readings
					const readingsPerDay = 96;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: createTimeString('2022-09-21', '00:00:00', '2022-10-05', '00:00:00'), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay);
				});
				// Test 15 minutes over all time for flow unit.
				mocha.it('should have daily points for 15 minute reading intervals and flow units with +-inf start/end time & kW as kW', async () => {
					const unitData = [
						['kW', '', Unit.unitRepresentType.FLOW, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, true, 'kilowatts'],
						['Electric', '', Unit.unitRepresentType.FLOW, 3600, Unit.unitType.METER, '', Unit.displayableType.NONE, false, 'special unit']
					];
					const conversionData = [
						['Electric', 'kW', false, 1, 0, 'Electric → kW']
					];
					const meterData = [
						{
							name: 'Electric kW',
							unit: 'Electric',
							defaultGraphicUnit: 'kW',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];

					await prepareTest(unitData, conversionData, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('kW');
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_kW_gu_kW_st_-inf_et_inf.csv');
					// file has daily readings
					const readingsPerDay = 1;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: ETERNITY.toString(), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay);
				});
				// Test 15 minutes over all time for raw unit.
				mocha.it('should have daily points for 15 minute reading intervals and raw units with +-inf start/end time & Celsius as Celsius', async () => {
					const unitData = [
						['C', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, true, 'Celsius'],
						['Degrees', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.METER, '', Unit.displayableType.NONE, false, 'special unit']
					];
					const conversionData = [
						['Degrees', 'C', false, 1, 0, 'Degrees → C']
					];
					const meterData = [
						{
							name: 'Degrees Celsius',
							unit: 'Degrees',
							defaultGraphicUnit: 'C',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];

					await prepareTest(unitData, conversionData, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('C');
					// Reuse same file as flow since value should be the same values.
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_kW_gu_kW_st_-inf_et_inf.csv');
					// file has daily readings
					const readingsPerDay = 1;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: ETERNITY.toString(), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay)
				});
				mocha.it('should have daily points for 15 minute reading intervals and quantity units with +-inf start/end time & kWh as MJ', async () => {
					const unitData = unitDatakWh.concat([
						['MJ', 'megaJoules', Unit.unitRepresentType.QUANTITY, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, false, 'MJ']
					]);
					const conversionData = conversionDatakWh.concat([
						['kWh', 'MJ', true, 3.6, 0, 'kWh → MJ']
					]);
					const meterData = [
						{
							name: 'Electric Utility MJ',
							unit: 'Electric_Utility',
							defaultGraphicUnit: 'MJ',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];

					await prepareTest(unitData, conversionData, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('MJ');
					// Reuse same file as flow since value should be the same values.
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_kWh_gu_MJ_st_-inf_et_inf.csv');
					// file has daily readings
					const readingsPerDay = 1;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: ETERNITY.toString(), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay)
				});
				mocha.it('should have daily points for 15 minute reading intervals and quantity units with +-inf start/end time & kWh as MJ reverse conversion', async () => {
					const unitData = unitDatakWh.concat([
						['MJ', 'megaJoules', Unit.unitRepresentType.QUANTITY, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, false, 'MJ']
					]);
					const conversionData = conversionDatakWh.concat([
						['MJ', 'kWh', true, 1 / 3.6, 0, 'MJ → KWh']
					]);
					const meterData = [
						{
							name: 'Electric Utility MJ',
							unit: 'Electric_Utility',
							defaultGraphicUnit: 'MJ',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];

					await prepareTest(unitData, conversionData, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('MJ');
					// Reuse same file as flow since value should be the same values.
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_kWh_gu_MJ_st_-inf_et_inf.csv');
					// file has daily readings
					const readingsPerDay = 1;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: ETERNITY.toString(), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay)
				});
				mocha.it('should have daily points for 15 minute reading intervals and quantity units with +-inf start/end time & kWh as BTU chained', async () => {
					const unitData = unitDatakWh.concat([
						['MJ', 'megaJoules', Unit.unitRepresentType.QUANTITY, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, false, 'MJ'],
						['BTU', '', Unit.unitRepresentType.QUANTITY, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, true, 'OED created standard unit']
					]);
					const conversionData = conversionDatakWh.concat([
						['kWh', 'MJ', true, 3.6, 0, 'kWh → MJ'],
						['MJ', 'BTU', true, 947.8, 0, 'MJ → BTU']
					]);
					const meterData = [
						{
							name: 'Electric_Utility BTU',
							unit: 'Electric_Utility',
							defaultGraphicUnit: 'BTU',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];

					await prepareTest(unitData, conversionData, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('BTU');
					// Reuse same file as flow since value should be the same values.
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_kWh_gu_BTU_st_-inf_et_inf.csv');
					// file has daily readings
					const readingsPerDay = 1;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: ETERNITY.toString(), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay)
				});

				mocha.it('should have daily points for 15 minute reading intervals and quantity units with +-inf start/end time & kWh as BTU chained with reverse conversion', async () => {
					const unitData = unitDatakWh.concat([
						['MJ', 'megaJoules', Unit.unitRepresentType.QUANTITY, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, false, 'MJ'],
						['BTU', '', Unit.unitRepresentType.QUANTITY, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, true, 'OED created standard unit']
					]);
					const conversionData = conversionDatakWh.concat([
						['MJ', 'kWh', true, 1 / 3.6, 0, 'MJ → KWh'],
						['MJ', 'BTU', true, 947.8, 0, 'MJ → BTU']
					]);
					const meterData = [
						{
							name: 'Electric_Utility BTU',
							unit: 'Electric_Utility',
							defaultGraphicUnit: 'BTU',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];

					await prepareTest(unitData, conversionData, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('BTU');
					// Reuse same file as flow since value should be the same values.
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_kWh_gu_BTU_st_-inf_et_inf.csv');
					// file has daily readings
					const readingsPerDay = 1;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: ETERNITY.toString(), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay)
				});
				mocha.it('should have hourly points for middle readings of 15 minute for a 60 day period and quantity units & kWh as MJ', async () => {
					const unitData = unitDatakWh.concat([
						['MJ', 'megaJoules', Unit.unitRepresentType.QUANTITY, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, false, 'MJ']
					]);
					const conversionData = conversionDatakWh.concat([
						['kWh', 'MJ', true, 3.6, 0, 'kWh → MJ']
					]);
					const meterData = [
						{
							name: 'Electric_Utility MJ',
							unit: 'Electric_Utility',
							defaultGraphicUnit: 'MJ',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];

					await prepareTest(unitData, conversionData, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('MJ');
					// Reuse same file as flow since value should be the same values.
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_kWh_gu_MJ_st_2022-08-25%00#00#00_et_2022-10-24%00#00#00.csv');
					// file has hourly readings
					const readingsPerDay = 24;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: createTimeString('2022-08-25', '00:00:00', '2022-10-24', '00:00:00'), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay)
				});
				mocha.it('should have hourly points for middle readings of 15 minute for a 60 day period and raw units & C as F with intercept', async () => {
					const unitData = [
						['C', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, true, 'Celsius'],
						['Degrees', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.METER, '', Unit.displayableType.NONE, false, 'special unit'],
						['F', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, false, 'OED created standard unit']
					];
					const conversionData = [
						['Degrees', 'C', false, 1, 0, 'Degrees → C'],
						['C', 'F', true, 1.8, 32, 'Celsius → Fahrenheit']
					];
					const meterData = [
						{
							name: 'Degrees F',
							unit: 'Degrees',
							defaultGraphicUnit: 'F',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];

					await prepareTest(unitData, conversionData, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('F');
					// Reuse same file as flow since value should be the same values.
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_C_gu_F_st_2022-08-25%00#00#00_et_2022-10-24%00#00#00.csv');
					// file has hourly readings
					const readingsPerDay = 24;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: createTimeString('2022-08-25', '00:00:00', '2022-10-24', '00:00:00'), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay)
				});
				mocha.it('should have raw points for middle readings of 15 minute for a 14 day period and quantity units & kWh as MJ', async () => {
					const unitData = unitDatakWh.concat([
						['MJ', 'megaJoules', Unit.unitRepresentType.QUANTITY, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, false, 'MJ']
					]);
					const conversionData = conversionDatakWh.concat([
						['kWh', 'MJ', true, 3.6, 0, 'kWh → MJ']
					]);
					const meterData = [
						{
							name: 'Electric_Utility MJ',
							unit: 'Electric_Utility',
							defaultGraphicUnit: 'MJ',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];

					await prepareTest(unitData, conversionData, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('MJ');
					// Reuse same file as flow since value should be the same values.
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_kWh_gu_MJ_st_2022-09-21%00#00#00_et_2022-10-05%00#00#00.csv');
					// file has hourly readings
					const readingsPerDay = 96;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: createTimeString('2022-09-21', '00:00:00', '2022-10-05', '00:00:00'), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay)
				});
				mocha.it('should have raw points for middle readings of 15 minute for a 14 day period and raw units & C as F with intercept', async () => {
					const unitData = [
						['C', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, true, 'Celsius'],
						['Degrees', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.METER, '', Unit.displayableType.NONE, false, 'special unit'],
						['F', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, false, 'OED created standard unit']
					];
					const conversionData = [
						['Degrees', 'C', false, 1, 0, 'Degrees → C'],
						['C', 'F', true, 1.8, 32, 'Celsius → Fahrenheit']
					];
					const meterData = [
						{
							name: 'Degrees F',
							unit: 'Degrees',
							defaultGraphicUnit: 'F',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];

					await prepareTest(unitData, conversionData, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('F');
					// Reuse same file as flow since value should be the same values.
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_C_gu_F_st_2022-09-21%00#00#00_et_2022-10-05%00#00#00.csv');
					// file has hourly readings
					const readingsPerDay = 96;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: createTimeString('2022-09-21', '00:00:00', '2022-10-05', '00:00:00'), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay)
				});

				mocha.it('should have daily points for 15 minute reading intervals and raw units with +-inf start/end time & C as F with intercept', async () => {
					const unitData = [
						['C', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, true, 'Celsius'],
						['Degrees', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.METER, '', Unit.displayableType.NONE, false, 'special unit'],
						['F', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, false, 'OED created standard unit']
					];
					const conversionData = [
						['Degrees', 'C', false, 1, 0, 'Degrees → C'],
						['C', 'F', true, 1.8, 32, 'Celsius → Fahrenheit']
					];
					const meterData = [
						{
							name: 'Degrees F',
							unit: 'Degrees',
							defaultGraphicUnit: 'F',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];

					await prepareTest(unitData, conversionData, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('F');
					// Reuse same file as flow since value should be the same values.
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_C_gu_F_st_-inf_et_inf.csv');
					// file has daily readings
					const readingsPerDay = 1;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: ETERNITY.toString(), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay)
				});

				mocha.it('should have daily points for 15 minute reading intervals and raw units with +-inf start/end time & C as F with intercept reverse conversion', async () => {
					const unitData = [
						['C', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, true, 'Celsius'],
						['Degrees', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.METER, '', Unit.displayableType.NONE, false, 'special unit'],
						['F', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, false, 'OED created standard unit']
					];
					const conversionData = [
						['Degrees', 'C', false, 1, 0, 'Degrees → C'],
						['F', 'C', true, 1 / 1.8, -32 / 1.8, 'Fahrenheit → Celsius']
					];
					const meterData = [
						{
							name: 'Degrees F',
							unit: 'Degrees',
							defaultGraphicUnit: 'F',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];

					await prepareTest(unitData, conversionData, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('F');
					// Reuse same file as flow since value should be the same values.
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_C_gu_F_st_-inf_et_inf.csv');
					// file has daily readings
					const readingsPerDay = 1;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: ETERNITY.toString(), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay)
				});


				mocha.it('should have daily points for 15 minute reading intervals and flow units with +-inf start/end time & thing as thing where rate is 36', async () => {
					const unitData = [
						['Thing_36', '', Unit.unitRepresentType.FLOW, 36, Unit.unitType.METER, '', Unit.displayableType.NONE, false, 'special unit'],
						['thing unit', '', Unit.unitRepresentType.FLOW, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, false, 'special unit']
					];
					const conversionData = [
						['Thing_36', 'thing unit', false, 1, 0, 'Thing_36 → thing unit']
					];
					const meterData = [
						{
							name: 'Thing_36 thing unit',
							unit: 'Thing_36',
							defaultGraphicUnit: 'thing unit',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];

					await prepareTest(unitData, conversionData, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('thing unit');
					// Reuse same file as flow since value should be the same values.
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_Thing36_gu_thing_st_-inf_et_inf.csv');
					// file has daily readings
					const readingsPerDay = 1;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: ETERNITY.toString(), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay)
				});
				mocha.it('should have daily points for 15 minute reading intervals and raw units with +-inf start/end time & C as Widget with intercept & chained', async () => {
					const unitData = [
						['C', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, true, 'Celsius'],
						['Degrees', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.METER, '', Unit.displayableType.NONE, false, 'special unit'],
						['F', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, false, 'OED created standard unit'],
						['Widget', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, false, 'fake unit']
					];
					const conversionData = [
						['Degrees', 'C', false, 1, 0, 'Degrees → C'],
						['C', 'F', true, 1.8, 32, 'Celsius → Fahrenheit'],
						['F', 'Widget', true, 5, 3, 'Fahrenheit → Widget']
					];
					const meterData = [
						{
							name: 'Degrees Widget',
							unit: 'Degrees',
							defaultGraphicUnit: 'Widget',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];

					await prepareTest(unitData, conversionData, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('Widget');
					// Reuse same file as flow since value should be the same values.
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_C_gu_Widget_st_-inf_et_inf.csv');
					// file has daily readings
					const readingsPerDay = 1;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: ETERNITY.toString(), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay)
				});
				mocha.it('should have daily points for 15 minute reading intervals and raw units with +-inf start/end time & C as Widget with intercept & chained & reverse conversions', async () => {
					const unitData = [
						['C', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, true, 'Celsius'],
						['Degrees', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.METER, '', Unit.displayableType.NONE, false, 'special unit'],
						['F', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, false, 'OED created standard unit'],
						['Widget', '', Unit.unitRepresentType.RAW, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, false, 'fake unit']
					];
					const conversionData = [
						['Degrees', 'C', false, 1, 0, 'Degrees → C'],
						['F', 'C', true, 1 / 1.8, -32 / 1.8, 'Fahrenheit → Celsius'],
						['Widget', 'F', true, 0.2, -3 / 5, 'Fahrenheit → Widget']
					];
					const meterData = [
						{
							name: 'Degrees Widget',
							unit: 'Degrees',
							defaultGraphicUnit: 'Widget',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];

					await prepareTest(unitData, conversionData, meterData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('Widget');
					// Reuse same file as flow since value should be the same values.
					const expected = await parseExpectedCsv('src/server/test/web/readingsData/expected_line_ri_15_mu_C_gu_Widget_st_-inf_et_inf.csv');
					// file has daily readings
					const readingsPerDay = 1;
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: ETERNITY.toString(), graphicUnitId: unitId, sequenceNumber: 1});
					expectThreeDReadingToEqualExpected(res, expected, readingsPerDay)
				});
				// When an invalid unit is added to a meter and loaded to the db, the API should return an empty array
				mocha.it('should return an empty json object for an invalid unit', async () => {
					const unitData = [
						['kWh', '', Unit.unitRepresentType.QUANTITY, 3600, Unit.unitType.UNIT, '', Unit.displayableType.ALL, true, 'OED created standard unit'],
						['invalidUnit', '', Unit.unitRepresentType.UNUSED, 1, Unit.unitType.UNIT, '', Unit.displayableType.ALL, true, 'Invalid Unit']
					];
					const conversionData = [
						['invalidUnit', 'kWh', false, 1, 0, 'invalidUnit → kWh']
					];
					const meterData = [
						{
							name: 'Invalid',
							unit: 'invalidUnit',
							defaultGraphicUnit: 'kWh',
							displayable: true,
							gps: undefined,
							note: 'invalid meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						}
					];
					await prepareTest(unitData, conversionData, meterData);
					//Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('kWh');
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: ETERNITY.toString(), graphicUnitId: unitId, sequenceNumber: 1 });
					expect(res).to.be.json;
					expect(res.body).to.have.property('xData');
					expect(res.body).to.have.property('yData');
					expect(res.body).to.have.property('zData');
				});

			});

			mocha.describe('for groups', () => {
				// A reading response should have a reading, startTimestamp, and endTimestamp key
				mocha.it('response should have valid reading and timestamps,', async () => {
					// Create 2D array for meter to feed into the database
					// Note the meter ID is set so we know what to expect when a query is made.
					const meterData = [
						{
							name: 'Electric Utility kWh',
							unit: 'Electric_Utility',
							defaultGraphicUnit: 'kWh',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: METER_ID
						},
						{
							name: 'Electric Utility kWh 2-6',
							unit: 'Electric_Utility',
							defaultGraphicUnit: 'kWh',
							displayable: true,
							gps: undefined,
							note: 'special meter',
							file: 'test/web/readingsData/readings_ri_15_days_75.csv',
							deleteFile: false,
							readingFrequency: '15 minutes',
							id: (METER_ID + 1)
						}
					];
					const groupData = [['Electric Utility 1-5 + 2-6 kWh', 'kWh', true, undefined, 'special group', ['Electric Utility kWh', 'Electric Utility kWh 2-6'], [], GROUP_ID]];
					// Load the data into the database
					await prepareTest(unitDatakWh, conversionDatakWh, meterData, groupData);
					// Get the unit ID since the DB could use any value.
					const unitId = await getUnitId('kWh');
					const res = await chai.request(app).get(`/api/unitReadings/threeD/groups/${GROUP_ID}`)
						.query({ timeInterval: ETERNITY.toString(), graphicUnitId: unitId, sequenceNumber: 1 });
					// unitReadings should be returning json
					expect(res).to.be.json;
					// the route should not return a bad request
					expect(res).to.have.status(HTTP_CODE.OK);
					expect(res.body).to.have.property(`xData`);
					expect(res.body).to.have.property(`yData`);
					expect(res.body).to.have.property(`zData`);
				});
			});
		});
	});	
	// These tests check the API behavior when improper calls are made, typically with incomplete parameters
	// The API should return status code 400 regardless of what is in the database, so no data is loaded in these tests
	mocha.describe('rejection tests, test behavior with invalid api calls', () => {
		mocha.describe('for threeD graphs', () => {
			// The logic here is effectively the same as the line charts, however bar charts have an added
			// barWidthDays parameter that must me accounted for, which adds a few extra steps
			mocha.describe('for meters', () => {
				mocha.it('rejects requests without a timeInterval or sequenceNumber or graphicUnitId', async () => {
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`);
					expect(res).to.have.status(HTTP_CODE.BAD_REQUEST);
				});
				mocha.it('rejects requests without a timeInterval', async () => {
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({graphicUnitId: 1, sequenceNumber: 1});
					expect(res).to.have.status(HTTP_CODE.BAD_REQUEST);
				});
				mocha.it('reject if request does not have graphicUnitID', async () => {
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: ETERNITY.toString(), sequenceNumber: 1});
					expect(res).to.have.status(HTTP_CODE.BAD_REQUEST);
				});
				mocha.it('reject if request does not have sequenceNumber', async () => {
					const res = await chai.request(app).get(`/api/unitReadings/threeD/meters/${METER_ID}`)
						.query({ timeInterval: ETERNITY.toString(), graphicUnitId: 1});
					expect(res).to.have.status(HTTP_CODE.BAD_REQUEST);
				});
			});
			mocha.describe('for groups', () => {
				mocha.it('rejects requests without a timeInterval or sequenceNumber or graphicUnitId', async () => {
					const res = await chai.request(app).get(`/api/unitReadings/threeD/groups/${GROUP_ID}`);
					expect(res).to.have.status(HTTP_CODE.BAD_REQUEST);
				});
				mocha.it('rejects requests without a sequenceNumber', async () => {
					const res = await chai.request(app).get(`/api/unitReadings/threeD/groups/${GROUP_ID}`)
						.query({ timeInterval: ETERNITY.toString(), graphicUnitId: 1 });
					expect(res).to.have.status(HTTP_CODE.BAD_REQUEST);
				});
				mocha.it('rejects requests without a timeInterval', async () => {
					const res = await chai.request(app).get(`/api/unitReadings/threeD/groups/${GROUP_ID}`)
						.query({ sequenceNumber: 1, graphicUnitId: 1 });
					expect(res).to.have.status(HTTP_CODE.BAD_REQUEST);
				});
				mocha.it('reject if request does not have graphicUnitID', async () => {
					const res = await chai.request(app).get(`/api/unitReadings/threeD/groups/${GROUP_ID}`)
						.query({ timeInterval: ETERNITY.toString(), sequenceNumber: 1 });
					expect(res).to.have.status(HTTP_CODE.BAD_REQUEST);
				});
			});
		});
	});
});