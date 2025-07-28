// Test Enhanced RAG Functions
import { mockRagApiService } from './src/services/mockRagApiService.js';

console.log('🚀 Testing Enhanced RAG Mock API Service\n');

async function runBasicTests() {
  try {
    console.log('1. Testing retrieveForRAG...');
    const retrieveResult = await mockRagApiService.retrieveForRAG('テスト検索');
    console.log(`   ✅ Success: ${retrieveResult.metadata.totalResults} results in ${retrieveResult.metadata.processingTime}`);

    console.log('\n2. Testing queryForSearch...');
    const queryResult = await mockRagApiService.queryForSearch('ドキュメント', {
      pageSize: 5,
      includeQuerySuggestions: true
    });
    console.log(`   ✅ Success: ${queryResult.metadata.totalResults} results, suggestions: ${queryResult.metadata.hasSuggestions}`);

    console.log('\n3. Testing getSuggestions...');
    const suggestions = await mockRagApiService.getSuggestions('テスト');
    console.log(`   ✅ Success: ${suggestions.length} suggestions found`);
    suggestions.forEach((suggestion, index) => {
      console.log(`      ${index + 1}. ${suggestion}`);
    });

    console.log('\n4. Testing searchWithFacets...');
    const facetedResult = await mockRagApiService.searchWithFacets(
      'PDF文書',
      ['_file_type', '_category'],
      { '_file_type': ['pdf'] }
    );
    console.log(`   ✅ Success: ${facetedResult.metadata.totalResults} filtered results`);
    console.log(`   📊 Facets available: ${facetedResult.processedFacets?.length || 0}`);

    console.log('\n5. Testing error simulation...');
    try {
      await mockRagApiService.simulateError('rate_limit');
      console.log('   ❌ Error test failed - should have thrown an error');
    } catch (error) {
      console.log('   ✅ Error handling working correctly');
    }

    console.log('\n🎉 All basic tests completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

runBasicTests();