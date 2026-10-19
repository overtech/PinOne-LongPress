"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoardFactory = void 0;
const serialPort_1 = require("./serialPort");
const simulatedBoard_1 = require("./simulatedBoard");
/**
 * Board Factory
 * Creates either a real or simulated board based on configuration
 */
class BoardFactory {
    /**
     * Create a board instance (real or simulated)
     * @returns IBoard instance
     */
    static createBoard() {
        if (this.isSimulationMode()) {
            console.log('[BoardFactory] Creating simulated board');
            return new simulatedBoard_1.SimulatedBoard();
        }
        else {
            console.log('[BoardFactory] Creating real hardware board');
            return new serialPort_1.Board();
        }
    }
    /**
     * Check if simulation mode is enabled
     * Priority:
     * 1. Explicitly set via setSimulationMode()
     * 2. Environment variable PINONE_SIMULATE
     * 3. Default to false (real hardware)
     */
    static isSimulationMode() {
        // If explicitly set, use that
        if (this.simulationMode !== null) {
            return this.simulationMode;
        }
        // Check environment variable
        const envVar = process.env.PINONE_SIMULATE;
        if (envVar !== undefined) {
            return envVar === 'true' || envVar === '1' || envVar === 'yes';
        }
        // Default to real hardware
        return false;
    }
    /**
     * Explicitly set simulation mode
     * @param enabled - true for simulation, false for real hardware
     */
    static setSimulationMode(enabled) {
        console.log('[BoardFactory] Simulation mode set to:', enabled);
        this.simulationMode = enabled;
    }
    /**
     * Get current simulation mode status
     */
    static getSimulationMode() {
        return this.isSimulationMode();
    }
    /**
     * Reset simulation mode to use environment variable
     */
    static resetSimulationMode() {
        this.simulationMode = null;
    }
}
exports.BoardFactory = BoardFactory;
BoardFactory.simulationMode = null;
//# sourceMappingURL=boardFactory.js.map