"""Test elementari per risoluzione uffici e riassegnazione predittiva, eseguire: python test_uffici.py"""
import copy, json, unittest
from pathlib import Path
from uffici_adattivi import resolve_offices, fit_office_habits, choose_grouping
from simulatore_ascensori import make_requests, travel_seconds

BASE=json.loads((Path(__file__).parent/'parametri_ascensori.json').read_text(encoding='utf8'))

class OfficeModelTests(unittest.TestCase):
    def test_office_count_variable(self):
        for no in [1,6,15,30,60]:
            c=copy.deepcopy(BASE);c['offices']['number_of_offices']=no
            uff=resolve_offices(c)
            self.assertEqual(len(uff),no)
            self.assertEqual(sum(o['employees'] for o in uff),525)
            self.assertTrue(all(1<=o['floor']<=15 for o in uff))
    def test_without_focus_office(self):
        c=copy.deepcopy(BASE);c['offices']['number_of_offices']=1
        c['offices']['focus_office']={}
        self.assertEqual(resolve_offices(c)[0]['employees'],525)

    def test_explicit_offices_shared_floor(self):
        c=copy.deepcopy(BASE)
        c['offices']['number_of_offices']=2
        c['offices']['definitions']=[
          {'id':'Alfa','floor':7,'employees':30,'lunch_start_hour':12.0},
          {'id':'Beta','floor':7,'employees':20,'lunch_start_hour':13.0}]
        offs=resolve_offices(c)
        self.assertEqual([o['floor'] for o in offs],[7,7])
        self.assertEqual(len(make_requests(c,881)),len(make_requests(c,881)))
        self.assertTrue(all(r.office_id in ('Alfa','Beta') for r in make_requests(c,881)))
    def test_independent_holdout_and_grouping(self):
        tr=[make_requests(BASE,1101+i) for i in range(3)]
        te=[make_requests(BASE,2201+i) for i in range(2)]
        offices,m,baseline,_,stats=fit_office_habits(BASE,tr,te)
        self.assertEqual(len(m),30)
        self.assertTrue(stats['mae_office_5min_learned']>=0)
        choice=choose_grouping(BASE,m,13.2*3600,[(0,0),(1,5),(2,10),(3,15)],travel_seconds)
        self.assertEqual(len(choice),4)
        self.assertGreaterEqual(list(choice.values()).count(12),2)
        self.assertTrue(all(isinstance(f,int) and 0<=f<=15 for f in choice.values()))

if __name__=='__main__':unittest.main()
