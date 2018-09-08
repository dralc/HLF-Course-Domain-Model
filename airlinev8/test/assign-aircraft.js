'use strict';

const assert = require('chai').assert;
const utHarness = require('../utils/ut-harness');

const bnaDir = `${__dirname}/../`;
let adminConnection, bnConnection, bnDefinition;
let factory;

before('Install and start the Business Network App', (done) => {
    utHarness.initialize(bnaDir, (adminCon, bnCon, bnDef) => {
        adminConnection = adminCon;
        bnConnection = bnCon;
        bnDefinition = bnDef;
        factory = bnDefinition.getFactory();
        done();
    });
});

describe('Assign an Aircraft to a Flight', function () {

    const DAT = {
        NS_FLIGHT: 'org.acme.airline.flight',
        NS_AIRCRAFT: 'org.acme.airline.aircraft',
        AIRCRAFT_ID: 'Aircraft-001',
        FLIGHT_ID: 'Flight-001',
        INVALID_AIRCRAFT_ID: 'xx-invalid-aircraft-id',
        INVALID_FLIGHT_ID: 'xx-invalid-flight-id'
    };

    it('should NOT assign an aircraft to an invalid flight', async function () {
        // Create an AssignAircraft tx with an invalid flightId
        // Submitting this tx should throw an error
        try {
            let tx = factory.newTransaction(DAT.NS_FLIGHT, 'AssignAircraft');
            tx.flightId = DAT.INVALID_FLIGHT_ID;
            tx.aircraftId = DAT.AIRCRAFT_ID;

            await bnConnection.submitTransaction(tx);
            throw Error('Execution should NOT have reached here');
        } catch (error) {
            assert.equal(error.message, `Object with ID '${DAT.INVALID_FLIGHT_ID}' in collection with ID 'Asset:org.acme.airline.flight.Flight' does not exist`);
        }
    });

    let flightId;
    let flightRegistry;
    let aircraftRegistry;

    /**
     * Utility that returns a Function with signature function (ev)
     * It reduces boilerplate code when writing the listeners specific events
     *
     * @param {*} eventName
     * @param {Function} fn A callback
     *
     * @return {Function}
     */
    function listener(eventName, fn) {
        return (ev) => {
            switch (ev.$type) {
            case eventName:
                fn(ev);
                break;
            default:
                break;
            }
        };
    }

    before('Add a flight and aircraft to their registries', function (done) {
        try {
            // - Submit tx CreateFlight to add a new Flight asset. It generates the flightId
            let tx = factory.newTransaction('org.acme.airline.flight', 'CreateFlight');
            tx.flightNumber = 'SY001';
            tx.origin = 'SYD';
            tx.destination = 'MEL';
            tx.schedule = new Date('2029-01-15T01:01:01.001Z');

            // - Subscribe to 'events': FlightCreated to get the flightId
            bnConnection.on('event', listener('FlightCreated', async (ev) => {
                try {
                    let aircraft;
                    flightId = ev.flightId;

                    // Add an Aircraft
                    // - Directly add an Aircraft asset to its registry, save aircraft Id
                    aircraftRegistry = await bnConnection.getAssetRegistry(`${DAT.NS_AIRCRAFT}.Aircraft`);
                    aircraft = factory.newResource(DAT.NS_AIRCRAFT, 'Aircraft', DAT.AIRCRAFT_ID);
                    aircraft.firstClassSeats = 4;
                    aircraft.businessClassSeats = 6;
                    aircraft.economyClassSeats = 30;

                    await aircraftRegistry.add(aircraft);
                    done();
                } catch (error) {
                    console.error(error.stack);
                }
            }));

            bnConnection.submitTransaction(tx);

        } catch (error) {
            throw error;
        }
    });

    it('should assign a valid aircraft to a valid Flight (a timeout could mean the listener did not run)', function (done) {
        this.timeout(2000);
        assert.isString(flightId);
        assert.isString(DAT.AIRCRAFT_ID);

        (async () => {
            try {
                let aircraft = await aircraftRegistry.get(DAT.AIRCRAFT_ID);
                assert.isDefined(aircraft);

                flightRegistry = await bnConnection.getAssetRegistry('org.acme.airline.flight.Flight');
                let flight = await flightRegistry.get(flightId);
                assert.isDefined(flight);

                let tx = factory.newTransaction('org.acme.airline.flight', 'AssignAircraft');
                tx.flightId = flightId;
                tx.aircraftId = DAT.AIRCRAFT_ID;

                bnConnection.on('event', listener('AircraftAssigned', async (ev) => {
                    flight = await flightRegistry.get(flightId);
                    assert.equal(flight.aircraft.$identifier, DAT.AIRCRAFT_ID, `An incorrect aircraft id was assigned to the flight id ${flightId}`);
                    done();
                }));

                await bnConnection.submitTransaction(tx);
            }
            catch (err) {
                console.error(err.stack);
            }
        })();
    });

    it('should NOT assign an invalid Aircraft to a flight', async function () {
        try {
            let tx = factory.newTransaction(DAT.NS_FLIGHT, 'AssignAircraft');
            tx.flightId = flightId;
            tx.aircraftId = DAT.INVALID_AIRCRAFT_ID;

            await bnConnection.submitTransaction(tx);
            throw Error('Execution should NOT have reached here');
        } catch (error) {
            assert.equal(error.message, `Object with ID '${DAT.INVALID_AIRCRAFT_ID}' in collection with ID 'Asset:org.acme.airline.flight.Aircraft' does not exist`);
        }
    });

});