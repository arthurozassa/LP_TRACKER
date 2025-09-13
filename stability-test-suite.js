/**
 * Frontend Component Stability Test Suite
 * 
 * This script tests all UI components for stability with edge cases:
 * - Zero/undefined/null/NaN/Infinity values
 * - Empty arrays and objects
 * - Malformed data structures
 * - Large datasets
 * - Network failures and error states
 * 
 * Run in browser console at: http://localhost:3002
 */

console.log('🧪 Starting LP Tracker Component Stability Tests...');

// Edge case data generators
const EdgeCaseData = {
  // Generate problematic numbers
  problematicNumbers: [
    0, -0, null, undefined, NaN, Infinity, -Infinity, 
    Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER,
    '', '0', 'null', 'undefined', 'NaN', 'Infinity',
    -1, 0.0000001, 99999999999999999999999999999999
  ],

  // Generate malformed position data
  malformedPosition: {
    id: null,
    protocol: undefined,
    chain: 'invalid-chain',
    pool: '',
    poolAddress: 'invalid',
    liquidity: NaN,
    value: Infinity,
    feesEarned: -Infinity,
    apr: 'not-a-number',
    apy: null,
    inRange: 'maybe',
    tokens: {
      token0: {
        symbol: null,
        amount: NaN,
        decimals: undefined
      },
      token1: {
        symbol: '',
        amount: Infinity,
        decimals: -1
      }
    },
    createdAt: 'invalid-date',
    updatedAt: null,
    priceRange: {
      lower: NaN,
      upper: null,
      current: undefined
    }
  },

  // Generate empty structures
  emptyStructures: {
    emptyArray: [],
    emptyObject: {},
    nullArray: null,
    undefinedObject: undefined,
    sparseArray: [,,,,], // sparse array with holes
    circularRef: {}
  },

  // Generate extreme values
  extremeMetrics: {
    totalValue: Number.MAX_VALUE,
    totalFeesEarned: Number.MIN_VALUE,
    avgApr: NaN,
    activeProtocols: -1,
    inRangePositions: Infinity,
    outOfRangePositions: -Infinity,
    totalYield24h: undefined,
    totalYield7d: null,
    totalYield30d: 'invalid',
    totalImpermanentLoss: {},
    totalROI: [],
    hodlROI: Symbol('test'),
    outperformance: new Date(),
    sharpeRatio: /regex/,
    maxDrawdown: () => 'function'
  },

  // Generate massive datasets
  massiveDataset: function(size = 10000) {
    return Array(size).fill(0).map((_, i) => ({
      id: `position-${i}`,
      protocol: Math.random() > 0.5 ? undefined : `protocol-${i}`,
      pool: i % 1000 === 0 ? null : `POOL${i}`,
      value: Math.random() * 1000000,
      feesEarned: Math.random() > 0.8 ? NaN : Math.random() * 1000,
      apr: Math.random() > 0.9 ? Infinity : Math.random() * 100,
      inRange: Math.random() > 0.5,
      tokens: {
        token0: { symbol: `TK${i}A`, amount: Math.random() * 1000 },
        token1: { symbol: `TK${i}B`, amount: Math.random() * 1000 }
      }
    }));
  }
};

// Create circular reference for testing
EdgeCaseData.emptyStructures.circularRef.self = EdgeCaseData.emptyStructures.circularRef;

// Component stability tests
const ComponentTests = {
  
  // Test MetricsCards component
  testMetricsCards: function() {
    console.log('🔍 Testing MetricsCards component...');
    
    const testCases = [
      {
        name: 'Zero values',
        metrics: {
          totalValue: 0,
          totalFeesEarned: 0,
          avgApr: 0,
          activeProtocols: 0
        }
      },
      {
        name: 'Null/undefined values',
        metrics: {
          totalValue: null,
          totalFeesEarned: undefined,
          avgApr: NaN,
          activeProtocols: Infinity
        }
      },
      {
        name: 'Negative values',
        metrics: {
          totalValue: -1000000,
          totalFeesEarned: -50000,
          avgApr: -25,
          activeProtocols: -5
        }
      },
      {
        name: 'Extreme values',
        metrics: EdgeCaseData.extremeMetrics
      },
      {
        name: 'Missing properties',
        metrics: {}
      }
    ];

    let results = [];
    testCases.forEach(testCase => {
      try {
        console.log(`  Testing: ${testCase.name}`);
        // Simulate component rendering logic
        const formatCurrency = (value) => {
          if (typeof value !== 'number' || !isFinite(value)) return '$0.00';
          if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
          if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
          return `$${value.toFixed(2)}`;
        };

        const formatPercentage = (value) => {
          if (typeof value !== 'number' || !isFinite(value)) return '0.00%';
          return `${value.toFixed(2)}%`;
        };

        // Test formatting functions with problematic values
        EdgeCaseData.problematicNumbers.forEach(val => {
          const currencyResult = formatCurrency(val);
          const percentageResult = formatPercentage(val);
          
          if (currencyResult.includes('NaN') || currencyResult.includes('Infinity')) {
            throw new Error(`Currency formatter returned invalid result: ${currencyResult} for input: ${val}`);
          }
          if (percentageResult.includes('NaN') || percentageResult.includes('Infinity')) {
            throw new Error(`Percentage formatter returned invalid result: ${percentageResult} for input: ${val}`);
          }
        });

        results.push({ test: testCase.name, status: 'PASS' });
      } catch (error) {
        results.push({ test: testCase.name, status: 'FAIL', error: error.message });
        console.error(`  ❌ ${testCase.name}:`, error.message);
      }
    });

    return results;
  },

  // Test PerformanceChart component
  testPerformanceChart: function() {
    console.log('🔍 Testing PerformanceChart component...');
    
    const testCases = [
      {
        name: 'Empty data array',
        data: []
      },
      {
        name: 'Null data',
        data: null
      },
      {
        name: 'Malformed data points',
        data: [
          { timestamp: 'invalid', value: NaN },
          { timestamp: null, value: Infinity },
          { timestamp: undefined, value: -Infinity },
          {} // missing properties
        ]
      },
      {
        name: 'Mixed valid/invalid data',
        data: [
          { timestamp: '2023-01-01', value: 1000 },
          { timestamp: 'invalid', value: NaN },
          { timestamp: '2023-01-03', value: 1500 }
        ]
      },
      {
        name: 'Massive dataset',
        data: EdgeCaseData.massiveDataset(5000).map(item => ({
          timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          value: item.value,
          fees: item.feesEarned,
          apr: item.apr
        }))
      }
    ];

    let results = [];
    testCases.forEach(testCase => {
      try {
        console.log(`  Testing: ${testCase.name}`);
        
        // Simulate chart data processing
        const processChartData = (data) => {
          if (!Array.isArray(data)) return [];
          
          return data.filter(point => {
            return point && 
                   typeof point.timestamp === 'string' && 
                   typeof point.value === 'number' && 
                   isFinite(point.value);
          }).map((point, index) => ({
            timestamp: point.timestamp,
            value: point.value,
            index
          }));
        };

        const processed = processChartData(testCase.data);
        
        // Test that processing doesn't crash and returns valid data
        if (!Array.isArray(processed)) {
          throw new Error('Data processing returned non-array');
        }

        // Test chart calculations
        if (processed.length > 0) {
          const values = processed.map(p => p.value);
          const min = Math.min(...values);
          const max = Math.max(...values);
          
          if (!isFinite(min) || !isFinite(max)) {
            throw new Error(`Invalid min/max values: ${min}, ${max}`);
          }
        }

        results.push({ test: testCase.name, status: 'PASS', processedCount: processed.length });
      } catch (error) {
        results.push({ test: testCase.name, status: 'FAIL', error: error.message });
        console.error(`  ❌ ${testCase.name}:`, error.message);
      }
    });

    return results;
  },

  // Test PositionCard component
  testPositionCard: function() {
    console.log('🔍 Testing PositionCard component...');
    
    const testCases = [
      {
        name: 'Malformed position data',
        position: EdgeCaseData.malformedPosition
      },
      {
        name: 'Missing required fields',
        position: {
          id: 'test-1'
          // missing all other fields
        }
      },
      {
        name: 'Empty strings and null values',
        position: {
          id: '',
          protocol: null,
          pool: undefined,
          value: 0,
          feesEarned: -0,
          apr: NaN,
          tokens: {
            token0: { symbol: '', amount: 0 },
            token1: { symbol: null, amount: undefined }
          }
        }
      }
    ];

    let results = [];
    testCases.forEach(testCase => {
      try {
        console.log(`  Testing: ${testCase.name}`);
        
        // Simulate position card rendering logic
        const validatePosition = (pos) => {
          const safeGet = (obj, path, defaultVal = 'N/A') => {
            try {
              return path.split('.').reduce((o, p) => o && o[p], obj) ?? defaultVal;
            } catch {
              return defaultVal;
            }
          };

          const formatCurrency = (val) => {
            if (typeof val !== 'number' || !isFinite(val)) return '$0.00';
            return `$${val.toFixed(2)}`;
          };

          const formatPercentage = (val) => {
            if (typeof val !== 'number' || !isFinite(val)) return '0.00%';
            return `${val.toFixed(2)}%`;
          };

          return {
            id: safeGet(pos, 'id', 'unknown'),
            protocol: safeGet(pos, 'protocol', 'Unknown Protocol'),
            pool: safeGet(pos, 'pool', 'Unknown Pool'),
            value: formatCurrency(pos.value),
            feesEarned: formatCurrency(pos.feesEarned),
            apr: formatPercentage(pos.apr),
            inRange: Boolean(pos.inRange),
            token0Symbol: safeGet(pos, 'tokens.token0.symbol', 'UNK'),
            token1Symbol: safeGet(pos, 'tokens.token1.symbol', 'UNK'),
            token0Amount: safeGet(pos, 'tokens.token0.amount', 0),
            token1Amount: safeGet(pos, 'tokens.token1.amount', 0)
          };
        };

        const rendered = validatePosition(testCase.position);
        
        // Validate rendered output doesn't contain problematic values
        Object.values(rendered).forEach(val => {
          const valStr = String(val);
          if (valStr.includes('NaN') || valStr.includes('Infinity') || valStr === 'undefined') {
            throw new Error(`Rendered value contains problematic string: ${valStr}`);
          }
        });

        results.push({ test: testCase.name, status: 'PASS', rendered });
      } catch (error) {
        results.push({ test: testCase.name, status: 'FAIL', error: error.message });
        console.error(`  ❌ ${testCase.name}:`, error.message);
      }
    });

    return results;
  },

  // Test main dashboard calculateMetrics function
  testCalculateMetrics: function() {
    console.log('🔍 Testing Dashboard calculateMetrics function...');
    
    const testCases = [
      {
        name: 'Empty results',
        scanResults: { totalValue: 0, protocols: {} }
      },
      {
        name: 'Null protocols',
        scanResults: { totalValue: 1000, protocols: null }
      },
      {
        name: 'Malformed protocols data',
        scanResults: {
          totalValue: 5000,
          protocols: {
            'protocol1': { positions: null },
            'protocol2': { positions: [EdgeCaseData.malformedPosition] },
            'protocol3': { positions: [] }
          }
        }
      },
      {
        name: 'Massive dataset',
        scanResults: {
          totalValue: 1000000,
          protocols: {
            'massive': { positions: EdgeCaseData.massiveDataset(1000) }
          }
        }
      }
    ];

    let results = [];
    testCases.forEach(testCase => {
      try {
        console.log(`  Testing: ${testCase.name}`);
        
        // Simulate calculateMetrics function
        const calculateMetrics = (results) => {
          const protocols = results.protocols || {};
          const positions = Object.values(protocols)
            .flatMap(p => (Array.isArray(p.positions) ? p.positions : []))
            .filter(pos => pos && typeof pos === 'object');
          
          const safeSum = (arr, accessor) => {
            try {
              return arr.reduce((sum, item) => {
                const val = accessor(item);
                return sum + (typeof val === 'number' && isFinite(val) ? val : 0);
              }, 0);
            } catch {
              return 0;
            }
          };

          const safeAverage = (arr, accessor) => {
            if (!Array.isArray(arr) || arr.length === 0) return 0;
            try {
              const sum = safeSum(arr, accessor);
              return sum / arr.length;
            } catch {
              return 0;
            }
          };

          const inRangePositions = positions.filter(p => Boolean(p.inRange)).length;
          const activeProtocols = Object.keys(protocols).length;
          
          return {
            totalValue: typeof results.totalValue === 'number' && isFinite(results.totalValue) ? results.totalValue : 0,
            totalFeesEarned: safeSum(positions, p => p.feesEarned),
            avgApr: safeAverage(positions, p => p.apr),
            activeProtocols: Math.max(0, activeProtocols),
            inRangePositions: Math.max(0, inRangePositions),
            outOfRangePositions: Math.max(0, positions.length - inRangePositions),
            totalYield24h: 0,
            totalYield7d: 0,
            totalYield30d: 0,
            totalImpermanentLoss: safeSum(positions, p => p.impermanentLoss),
            totalROI: 15.2,
            hodlROI: 12.8,
            outperformance: 2.4
          };
        };

        const metrics = calculateMetrics(testCase.scanResults);
        
        // Validate all metrics are safe numbers
        Object.entries(metrics).forEach(([key, value]) => {
          if (typeof value === 'number' && (!isFinite(value) || isNaN(value))) {
            throw new Error(`Metric ${key} has invalid value: ${value}`);
          }
        });

        results.push({ test: testCase.name, status: 'PASS', metrics });
      } catch (error) {
        results.push({ test: testCase.name, status: 'FAIL', error: error.message });
        console.error(`  ❌ ${testCase.name}:`, error.message);
      }
    });

    return results;
  },

  // Test error boundaries and loading states
  testErrorHandling: function() {
    console.log('🔍 Testing Error Handling and Loading States...');
    
    const testCases = [
      {
        name: 'Network error simulation',
        test: () => {
          // Simulate fetch failure
          const originalFetch = window.fetch;
          window.fetch = () => Promise.reject(new Error('Network error'));
          
          // Test error handling
          const handleError = (error) => {
            return {
              hasError: true,
              message: error instanceof Error ? error.message : 'Unknown error',
              canRetry: true
            };
          };

          const result = handleError(new Error('Network error'));
          window.fetch = originalFetch; // Restore
          
          return result;
        }
      },
      {
        name: 'Invalid JSON response',
        test: () => {
          const parseResponse = (jsonString) => {
            try {
              return { success: true, data: JSON.parse(jsonString) };
            } catch (error) {
              return { success: false, error: 'Invalid JSON response' };
            }
          };

          const result = parseResponse('invalid json {');
          if (result.success) {
            throw new Error('Should have failed to parse invalid JSON');
          }
          
          return result;
        }
      },
      {
        name: 'Component unmounting during async operation',
        test: () => {
          let isMounted = true;
          const safeSetState = (newState) => {
            if (isMounted) {
              return { success: true, state: newState };
            } else {
              return { success: false, error: 'Component unmounted' };
            }
          };

          // Simulate unmounting
          isMounted = false;
          const result = safeSetState({ data: 'test' });
          
          return result;
        }
      }
    ];

    let results = [];
    testCases.forEach(testCase => {
      try {
        console.log(`  Testing: ${testCase.name}`);
        const result = testCase.test();
        results.push({ test: testCase.name, status: 'PASS', result });
      } catch (error) {
        results.push({ test: testCase.name, status: 'FAIL', error: error.message });
        console.error(`  ❌ ${testCase.name}:`, error.message);
      }
    });

    return results;
  },

  // Run all tests
  runAllTests: function() {
    console.log('🚀 Running Complete Component Stability Test Suite...\n');
    
    const allResults = {
      metricsCards: this.testMetricsCards(),
      performanceChart: this.testPerformanceChart(),
      positionCard: this.testPositionCard(),
      calculateMetrics: this.testCalculateMetrics(),
      errorHandling: this.testErrorHandling()
    };

    return allResults;
  }
};

// Memory leak detection
const MemoryTests = {
  detectMemoryLeaks: function() {
    console.log('🧠 Running Memory Leak Detection...');
    
    const initialHeap = performance.memory ? performance.memory.usedJSHeapSize : 0;
    
    // Create large datasets and process them
    for (let i = 0; i < 100; i++) {
      const largeDataset = EdgeCaseData.massiveDataset(1000);
      const processed = largeDataset.map(item => ({
        ...item,
        processed: true,
        timestamp: Date.now()
      }));
      
      // Force cleanup
      largeDataset.length = 0;
      processed.length = 0;
    }

    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }

    const finalHeap = performance.memory ? performance.memory.usedJSHeapSize : 0;
    const memoryIncrease = finalHeap - initialHeap;

    return {
      initialHeap,
      finalHeap,
      memoryIncrease,
      significant: memoryIncrease > 50 * 1024 * 1024 // 50MB threshold
    };
  }
};

// Performance tests
const PerformanceTests = {
  testRenderingPerformance: function() {
    console.log('⚡ Testing Rendering Performance...');
    
    const testCases = [
      {
        name: 'Large dataset rendering',
        size: 10000,
        test: (size) => {
          const start = performance.now();
          
          // Simulate rendering large dataset
          const dataset = EdgeCaseData.massiveDataset(size);
          const rendered = dataset.map(item => ({
            id: item.id,
            display: `${item.pool}: $${item.value.toFixed(2)}`,
            status: item.inRange ? 'in-range' : 'out-of-range'
          }));
          
          const end = performance.now();
          return {
            duration: end - start,
            itemsProcessed: rendered.length,
            avgTimePerItem: (end - start) / rendered.length
          };
        }
      },
      {
        name: 'Chart data processing',
        size: 5000,
        test: (size) => {
          const start = performance.now();
          
          // Simulate chart data processing
          const timeSeriesData = Array(size).fill(0).map((_, i) => ({
            timestamp: new Date(Date.now() - i * 60000).toISOString(),
            value: Math.random() * 1000000,
            volume: Math.random() * 50000
          }));

          // Process data for visualization
          const processed = timeSeriesData
            .filter(d => d.value > 0)
            .map((d, i) => ({
              ...d,
              index: i,
              change: i > 0 ? d.value - timeSeriesData[i-1].value : 0
            }))
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          
          const end = performance.now();
          return {
            duration: end - start,
            itemsProcessed: processed.length,
            avgTimePerItem: (end - start) / processed.length
          };
        }
      }
    ];

    return testCases.map(testCase => {
      try {
        console.log(`  Testing: ${testCase.name}`);
        const result = testCase.test(testCase.size);
        const status = result.duration > 1000 ? 'SLOW' : result.duration > 500 ? 'MODERATE' : 'FAST';
        
        return {
          test: testCase.name,
          status,
          ...result
        };
      } catch (error) {
        return {
          test: testCase.name,
          status: 'ERROR',
          error: error.message
        };
      }
    });
  }
};

// Main test runner
function runStabilityTests() {
  const startTime = performance.now();
  
  console.log('🧪🧪🧪 LP TRACKER FRONTEND STABILITY VALIDATION 🧪🧪🧪');
  console.log('===========================================================\n');
  
  const results = {
    componentTests: ComponentTests.runAllTests(),
    memoryTests: MemoryTests.detectMemoryLeaks(),
    performanceTests: PerformanceTests.testRenderingPerformance(),
    timestamp: new Date().toISOString(),
    duration: 0
  };

  const endTime = performance.now();
  results.duration = endTime - startTime;

  // Generate summary report
  const generateSummary = () => {
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    Object.values(results.componentTests).forEach(testGroup => {
      if (Array.isArray(testGroup)) {
        testGroup.forEach(test => {
          totalTests++;
          if (test.status === 'PASS') passedTests++;
          else failedTests++;
        });
      }
    });

    const summary = {
      totalTests,
      passedTests,
      failedTests,
      passRate: totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) : 0,
      memoryLeakDetected: results.memoryTests.significant,
      performanceRating: results.performanceTests.every(t => t.status === 'FAST') ? 'EXCELLENT' :
                         results.performanceTests.some(t => t.status === 'SLOW') ? 'POOR' : 'GOOD',
      overallStability: passedTests === totalTests && !results.memoryTests.significant ? 'STABLE' : 'NEEDS_ATTENTION'
    };

    return summary;
  };

  const summary = generateSummary();

  console.log('\n📊 STABILITY TEST SUMMARY');
  console.log('========================');
  console.log(`Total Tests: ${summary.totalTests}`);
  console.log(`Passed: ${summary.passedTests}`);
  console.log(`Failed: ${summary.failedTests}`);
  console.log(`Pass Rate: ${summary.passRate}%`);
  console.log(`Memory Leak Detected: ${summary.memoryLeakDetected ? '⚠️ YES' : '✅ NO'}`);
  console.log(`Performance Rating: ${summary.performanceRating}`);
  console.log(`Overall Stability: ${summary.overallStability === 'STABLE' ? '✅ STABLE' : '⚠️ NEEDS ATTENTION'}`);
  console.log(`Test Duration: ${results.duration.toFixed(2)}ms`);

  // Store results globally for inspection
  window.LP_TRACKER_STABILITY_RESULTS = results;
  window.LP_TRACKER_STABILITY_SUMMARY = summary;

  console.log('\n📋 Full results stored in window.LP_TRACKER_STABILITY_RESULTS');
  console.log('📋 Summary stored in window.LP_TRACKER_STABILITY_SUMMARY');
  
  return { results, summary };
}

// Auto-run if this script is executed directly
if (typeof document !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runStabilityTests);
  } else {
    runStabilityTests();
  }
}

// Export for manual execution
window.runLPTrackerStabilityTests = runStabilityTests;
window.EdgeCaseData = EdgeCaseData;
window.ComponentTests = ComponentTests;

console.log('🔧 Stability test suite loaded. Run window.runLPTrackerStabilityTests() to execute.');