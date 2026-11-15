import {describe,it,expect} from 'vitest';
import {parseExplorerSelection} from './explorer-selection';
const selection = {countryId:'Germany',studyAreaId:null,firstYear:2010,lastYear:2025,record:'raw',picked:{year:2022,month:6},region:{kind:'box',south:51,north:53,west:11,east:14}};
describe('statistics page selection',()=>{
 it('preserves the region, date range, data mode and month',()=>expect(parseExplorerSelection(JSON.stringify(selection))).toEqual(selection));
 it('rejects invalid dates and coordinates',()=>{
  expect(parseExplorerSelection(JSON.stringify({...selection,firstYear:2026}))).toBeUndefined();
  expect(parseExplorerSelection(JSON.stringify({...selection,region:{...selection.region,south:99}}))).toBeUndefined();
  expect(parseExplorerSelection(JSON.stringify({...selection,picked:{year:2022,month:13}}))).toBeUndefined();
 });
 it('handles missing and malformed URL state',()=>{expect(parseExplorerSelection(undefined)).toBeUndefined();expect(parseExplorerSelection('{')).toBeUndefined();});
});
