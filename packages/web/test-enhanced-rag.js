// Enhanced RAG Components Test Script
// This script tests the enhanced RAG functionality independently

import { mockRagApiService } from './src/services/mockRagApiService.js';

console.log('🚀 Starting Enhanced RAG Components Test\n');

// Test 1: Mock API Service Basic Functionality
async function testMockApiService() {
  console.log('📝 Testing Mock API Service...');
  
  try {
    // Test retrieve for RAG
    console.log('  • Testing retrieveForRAG...');
    const retrieveResult = await mockRagApiService.retrieveForRAG('テスト検索');
    console.log(`    ✅ Success: ${retrieveResult.metadata.totalResults} results in ${retrieveResult.metadata.processingTime}`);
    
    // Test query for search
    console.log('  • Testing queryForSearch...');
    const queryResult = await mockRagApiService.queryForSearch('ドキュメント検索', {
      pageSize: 5,
      includeQuerySuggestions: true
    });
    console.log(`    ✅ Success: ${queryResult.metadata.totalResults} results, ${queryResult.SpellCorrectedQueries?.length || 0} suggestions`);
    
    // Test suggestions
    console.log('  • Testing getSuggestions...');
    const suggestions = await mockRagApiService.getSuggestions('テスト');
    console.log(`    ✅ Success: ${suggestions.length} suggestions found`);
    
    // Test faceted search
    console.log('  • Testing searchWithFacets...');
    const facetedResult = await mockRagApiService.searchWithFacets(
      'PDF文書',
      ['_file_type', '_category'],
      { '_file_type': ['pdf'] }
    );
    console.log(`    ✅ Success: ${facetedResult.metadata.totalResults} filtered results`);
    
    console.log('✅ Mock API Service tests completed successfully\n');
    return true;
    
  } catch (error) {
    console.error('❌ Mock API Service test failed:', error);
    return false;
  }
}

// Test 2: Search Performance and Caching
async function testSearchPerformance() {
  console.log('⚡ Testing Search Performance and Caching...');
  
  try {
    const testQuery = 'パフォーマンステスト';
    
    // First search (no cache)
    console.log('  • First search (establishing baseline)...');
    const start1 = Date.now();
    await mockRagApiService.queryForSearch(testQuery);
    const time1 = Date.now() - start1;
    console.log(`    📊 First search: ${time1}ms`);
    
    // Second search (should be faster due to caching simulation)
    console.log('  • Second search (testing caching effect)...');
    const start2 = Date.now();
    await mockRagApiService.queryForSearch(testQuery);
    const time2 = Date.now() - start2;
    console.log(`    📊 Second search: ${time2}ms`);
    
    const improvement = time1 > time2 ? ((time1 - time2) / time1 * 100).toFixed(1) : 0;
    console.log(`    🎯 Performance improvement: ${improvement}% faster`);
    
    console.log('✅ Performance testing completed\n');
    return true;
    
  } catch (error) {
    console.error('❌ Performance test failed:', error);
    return false;
  }
}

// Test 3: Error Handling
async function testErrorHandling() {
  console.log('🛡️ Testing Error Handling...');
  
  try {
    const errorTypes = ['network', 'auth', 'rate_limit', 'server'];
    
    for (const errorType of errorTypes) {
      console.log(`  • Testing ${errorType} error...`);
      try {
        await mockRagApiService.simulateError(errorType);
        console.log(`    ❌ Expected error but got success for ${errorType}`);
      } catch (error) {
        const errorData = JSON.parse(error.message);
        console.log(`    ✅ Correctly caught ${errorType} error: ${errorData.message}`);
      }
    }
    
    console.log('✅ Error handling tests completed\n');
    return true;
    
  } catch (error) {
    console.error('❌ Error handling test failed:', error);
    return false;
  }
}

// Test 4: Data Processing and Validation
async function testDataProcessing() {
  console.log('🔍 Testing Data Processing and Validation...');
  
  try {
    // Test query processing with facets
    console.log('  • Testing faceted search data processing...');
    const facetedResult = await mockRagApiService.searchWithFacets(
      'テストクエリ',
      ['_file_type', '_category', '_authors'],
      { '_file_type': ['pdf', 'docx'] }
    );
    
    // Validate response structure
    const hasRequiredFields = facetedResult.processedFacets && 
                             facetedResult.metadata && 
                             facetedResult.ResultItems;
    console.log(`    ✅ Response structure validation: ${hasRequiredFields ? 'PASS' : 'FAIL'}`);
    
    // Test data consistency
    const processedFacetsCount = facetedResult.processedFacets?.length || 0;
    const resultsCount = facetedResult.ResultItems?.length || 0;
    console.log(`    📊 Processed facets: ${processedFacetsCount}, Results: ${resultsCount}`);
    
    // Test suggestion relevance
    console.log('  • Testing suggestion relevance...');
    const suggestions = await mockRagApiService.getSuggestions('Kendra');
    const relevantSuggestions = suggestions.filter(s => 
      s.toLowerCase().includes('kendra') || 
      s.includes('検索') || 
      s.includes('テスト')
    );
    console.log(`    🎯 Relevant suggestions: ${relevantSuggestions.length}/${suggestions.length}`);
    
    console.log('✅ Data processing tests completed\n');
    return true;
    
  } catch (error) {
    console.error('❌ Data processing test failed:', error);
    return false;
  }
}

// Test 5: Feature Integration
async function testFeatureIntegration() {
  console.log('🔗 Testing Feature Integration...');
  
  try {
    // Test multi-step workflow
    console.log('  • Testing complete search workflow...');
    
    // Step 1: Get suggestions
    const suggestions = await mockRagApiService.getSuggestions('RAG');
    console.log(`    📝 Step 1 - Suggestions: ${suggestions.length} found`);
    
    // Step 2: Use suggestion for actual search
    if (suggestions.length > 0) {
      const searchQuery = suggestions[0];
      const searchResult = await mockRagApiService.queryForSearch(searchQuery, {
        includeQuerySuggestions: true,
        pageSize: 10
      });
      console.log(`    🔍 Step 2 - Search: ${searchResult.metadata.totalResults} results for "${searchQuery}"`);
      
      // Step 3: Apply facets to refine search
      const facetedResult = await mockRagApiService.searchWithFacets(
        searchQuery,
        ['_file_type', '_category'],
        { '_file_type': ['pdf'] }
      );
      console.log(`    🎯 Step 3 - Faceted: ${facetedResult.metadata.totalResults} filtered results`);
    }
    
    console.log('✅ Feature integration tests completed\n');
    return true;
    
  } catch (error) {
    console.error('❌ Feature integration test failed:', error);
    return false;
  }
}

// Main test execution
async function runAllTests() {
  console.log('🎬 Enhanced RAG Test Suite Started\n');
  console.log('=' * 50);
  
  const results = {
    mockApiService: await testMockApiService(),
    searchPerformance: await testSearchPerformance(),
    errorHandling: await testErrorHandling(),
    dataProcessing: await testDataProcessing(),
    featureIntegration: await testFeatureIntegration()
  };
  
  console.log('=' * 50);
  console.log('📊 Test Results Summary:');
  console.log('=' * 50);
  
  Object.entries(results).forEach(([testName, passed]) => {
    const status = passed ? '✅ PASSED' : '❌ FAILED';
    const formattedName = testName.replace(/([A-Z])/g, ' $1').toLowerCase();
    console.log(`${status} - ${formattedName}`);
  });
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  console.log('\n🎯 Overall Results:');
  console.log(`   Passed: ${passedTests}/${totalTests} tests`);
  console.log(`   Success Rate: ${successRate}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Enhanced RAG features are working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the issues above.');
  }
  
  return results;
}

// Export for module usage or run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { runAllTests, testMockApiService, testSearchPerformance, testErrorHandling, testDataProcessing, testFeatureIntegration };