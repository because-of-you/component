if __name__ == '__main__':
    for i in range(1, 1001):
        print(f"create or replace view shuxin_thread_test_{i} as select at1.* from add_table1 at1 left join add_table1_view1 a on at1.Address = a.Address left join dim_mdm_industryproject on dim_mdm_industryproject.Address  = a.Address left join dwd_cb_contract28 on dwd_cb_contract28.AdjustAmount = a.Address;")
