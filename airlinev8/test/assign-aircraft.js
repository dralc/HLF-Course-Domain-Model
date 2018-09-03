'use strict';

const assert = require('chai').assert;
const utHarness = require('../utils/ut-harness');

const bnaDir = `${__dirname}/../`;
let adminConnection, bnConnection, bnDefinition;

before('Install and start the Business Network App', (done) => {
    utHarness.initialize(bnaDir, (adminCon, bnCon, bnDef) => {
        adminConnection = adminCon;
        bnConnection = bnCon;
        bnDefinition = bnDef;
        done();
    });
});

describe('Assign an Aircraft to a Flight', function () {

    let flightRegistry;
    let factory;

    before('Add a test asset to Flight and Aircraft registries', function (done) {
        factory = bnDefinition.getFactory();
        bnConnection.getAssetRegistry('org.acme.airline.flight.Flight')
            .then((registry)=>{
                flightRegistry = registry;
                done();
            });
    });

    it('should NOT assign an aircraft to an invalid flight', async function () {
        // Create an AssignAircraft tx with an invalid flightId
        // Submitting this tx should throw an error
        const flightId = 'abc-invalid-flight-id';
        const aircraftId = 'aircraft-001';

        try {
            let tx = factory.newTransaction('org.acme.airline.flight', 'AssignAircraft');
            tx.flightId = flightId;
            tx.aircraftId = aircraftId;

            await bnConnection.submitTransaction(tx);
            throw Error('Execution should NOT have reached here');
        } catch (error) {
            assert.equal(error.message, `Object with ID '${flightId}' in collection with ID 'Asset:org.acme.airline.flight.Flight' does not exist`);
        }
    });

    it('should assign an aircraft to a valid Flight', async function () {
        /*
        Process:
        Add a Flight
        - Submit tx CreateFlight to add a new Flight asset. It generates the flightId
        - Subscribe to 'events': FlightCreated to get the flightId

        Add an Aircraft
        - Directly add an Aircraft asset to its registry, save aircraftId

        Assign aircraft to Flight
        - Create new AssignAircraft tx, with flightId & aircraftId
        - Get the added Flight asset by flightId

        - assert that flight.aircraft is correct
         */

        assert.isOk(false);
    });

});