import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';

import {
  RefreshCw,
  Plus,
  Trash2,
  Download,
  FileText,
  Save,
  X,
  CheckCircle,
  Clock,
  Edit3,
  Wheat,
  AlertCircle,
  Search,
} from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  HarvestFestivalItem,
  Church,
} from '../../types';

import {
  exportToCSV,
  generatePDF,
} from '../../utils/export';


export default function HarvestFestivalPage() {

  const { profile, church } = useAuth();

  const isSuperAdmin =
    profile?.role === 'super_admin';

  const churchId =
    profile?.church_id || '';


  // ========================================================
  // DATA
  // ========================================================

  const [items, setItems] =
    useState<HarvestFestivalItem[]>([]);

  const [churches, setChurches] =
    useState<Church[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [selectedChurchId, setSelectedChurchId] =
    useState('');

  const [error, setError] =
    useState('');

  const [initialized, setInitialized] =
    useState(false);


  // ========================================================
  // ADD FORM
  // ========================================================

  const [form, setForm] = useState({
    item_name: '',
    consignor: '',
    consignor_church_id: '',
    purchased_person: '',
    purchased_person_church_id: '',
    purchased_person_contact: '',
    amount: '',
  });

  const [saving, setSaving] =
    useState(false);


  // ========================================================
  // SETTLED AMOUNT EDIT
  // ========================================================

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [editSettled, setEditSettled] =
    useState('');


  // ========================================================
  // FULL DETAILS EDIT
  // ========================================================

  const [editingDetailsId, setEditingDetailsId] =
    useState<string | null>(null);

  const [editItemName, setEditItemName] =
    useState('');

  const [editConsignor, setEditConsignor] =
    useState('');

  const [editConsignorChurchId, setEditConsignorChurchId] =
    useState('');

  const [editPurchasedPerson, setEditPurchasedPerson] =
    useState('');

  const [
    editPurchasedPersonChurchId,
    setEditPurchasedPersonChurchId,
  ] = useState('');

  const [
    editPurchasedPersonContact,
    setEditPurchasedPersonContact,
  ] = useState('');

  const [editAmount, setEditAmount] =
    useState('');


  // ========================================================
  // SEARCH
  // ========================================================

  const [searchQuery, setSearchQuery] =
    useState('');


  const activeChurchId =
    isSuperAdmin
      ? selectedChurchId
      : churchId;


  // ========================================================
  // FETCH CONTROL
  // ========================================================

  const fetchIdRef =
    useRef(0);


  // ========================================================
  // FETCH CHURCHES
  // ========================================================

  const fetchChurches = useCallback(
    async () => {

      const {
        data,
        error,
      } = await supabase
        .from('churches')
        .select('*')
        .order('name');


      if (error) {

        setError(
          error.message
        );

        return;

      }


      setChurches(
        data || []
      );

    },
    [
      isSuperAdmin,
    ]
  );


  // ========================================================
  // FETCH ITEMS
  // ========================================================

  const fetchItems = useCallback(
    async () => {

      const currentFetch =
        ++fetchIdRef.current;

      setLoading(true);
      setError('');


      try {

        let query =
          supabase
            .from(
              'harvest_festival_items'
            )
            .select('*')
            .order(
              'created_at',
              {
                ascending: true,
              }
            );


        if (
          !isSuperAdmin &&
          churchId
        ) {

          query =
            query.eq(
              'church_id',
              churchId
            );

        } else if (
          isSuperAdmin &&
          selectedChurchId
        ) {

          query =
            query.eq(
              'church_id',
              selectedChurchId
            );

        }


        const {
          data,
          error: queryError,
        } = await query;


        if (queryError) {
          console.error(
            'Harvest Festival fetch error:',
            queryError
          );
          throw queryError;
        }


        if (
          currentFetch !==
          fetchIdRef.current
        ) {

          return;

        }


        const itemData =
          (data || []) as any[];


        /*
         * Get all church IDs used by:
         * main church
         * consignor church
         * purchased person's church
         */

        const churchIds = [
          ...new Set(
            itemData.flatMap(
              item => [
                item.church_id,
                item.consignor_church_id,
                item.purchased_person_church_id,
              ].filter(Boolean)
            )
          ),
        ];


        let churchMap =
          new Map<string, any>();


        if (
          churchIds.length > 0
        ) {

          const {
            data: churchData,
          } = await supabase
            .from('churches')
            .select(
              'id,name,location'
            )
            .in(
              'id',
              churchIds
            );


          churchMap =
            new Map(
              (
                churchData || []
              ).map(
                (c: any) => [
                  c.id,
                  c,
                ]
              )
            );

        }


        const enriched =
          itemData.map(
            item => ({

              ...item,

              church:
                churchMap.get(
                  item.church_id
                ) || null,

              consignor_church:
                churchMap.get(
                  item.consignor_church_id
                ) || null,

              purchased_person_church:
                churchMap.get(
                  item.purchased_person_church_id
                ) || null,

            })
          );


        if (
          currentFetch ===
          fetchIdRef.current
        ) {

          setItems(
            enriched as HarvestFestivalItem[]
          );

        }

      } catch (
        err: any
      ) {

        if (
          currentFetch ===
          fetchIdRef.current
        ) {

          setError(
            err.message ||
            'Failed to load items'
          );

          setItems([]);

        }

      } finally {

        if (
          currentFetch ===
          fetchIdRef.current
        ) {

          setLoading(false);

        }

      }

    },
    [
      isSuperAdmin,
      churchId,
      selectedChurchId,
    ]
  );


  // ========================================================
  // INITIAL LOAD
  // ========================================================

  useEffect(() => {

    if (!profile)
      return;

    if (initialized)
      return;


    const initialize =
      async () => {

        await fetchChurches();

        setInitialized(true);

      };


    initialize();

  }, [
    profile,
    initialized,
    fetchChurches,
  ]);


  // ========================================================
  // LOAD ITEMS
  // ========================================================

  useEffect(() => {

    if (!profile)
      return;

    if (!initialized)
      return;


    if (
      isSuperAdmin &&
      !selectedChurchId
    ) {

      return;

    }


    fetchItems();

  }, [
    profile,
    initialized,
    isSuperAdmin,
    selectedChurchId,
    fetchItems,
  ]);


  // ========================================================
  // ADD ITEM
  // ========================================================

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setError('');

    const cId = isSuperAdmin
      ? selectedChurchId
      : churchId;

    if (!cId) {
      setError('Please select a church.');
      setSaving(false);
      return;
    }

    const itemName = form.item_name.trim();
    const purchasedPerson = form.purchased_person.trim();
    const amount = Number(form.amount);

    if (!itemName) {
      setError('Please enter the item name.');
      setSaving(false);
      return;
    }

    if (!purchasedPerson) {
      setError('Please enter the purchased-by person name.');
      setSaving(false);
      return;
    }

    if (
      form.amount.trim() === '' ||
      Number.isNaN(amount) ||
      amount < 0
    ) {
      setError('Please enter a valid amount.');
      setSaving(false);
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from('harvest_festival_items')
        .insert({
          church_id: cId,
          item_name: itemName,
          consignor: form.consignor.trim() || null,
          consignor_church_id:
            form.consignor_church_id || null,
          purchased_person: purchasedPerson,
          purchased_person_church_id:
            form.purchased_person_church_id || null,
          purchased_person_contact:
            form.purchased_person_contact.trim() || null,
          amount,
          status: 'due',
          settled_amount: 0,
        });

      if (insertError) {
        throw insertError;
      }

      setForm({
        item_name: '',
        consignor: '',
        consignor_church_id: '',
        purchased_person: '',
        purchased_person_church_id: '',
        purchased_person_contact: '',
        amount: '',
      });

      await fetchItems();
    } catch (err: any) {
      console.error(
        'Harvest Festival insert error:',
        err
      );

      setError(
        err?.message ||
        'Failed to add item'
      );
    } finally {
      setSaving(false);
    }
  }

  // ========================================================
  // STATUS CHANGE
  // ========================================================

  async function handleStatusChange(
    id: string,
    status: 'paid' | 'due'
  ) {
    const item = items.find(i => i.id === id);

    if (!item) {
      setError('Item not found.');
      return;
    }

    const updates: {
      status: 'paid' | 'due';
      settled_amount?: number;
    } = {
      status,
    };

    if (status === 'paid') {
      updates.settled_amount =
        Number(item.amount) || 0;
    }

    const { error } = await supabase
      .from('harvest_festival_items')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error(
        'Harvest Festival status update error:',
        error
      );

      setError(error.message);
      return;
    }

    await fetchItems();
  }

  // ========================================================
  // DELETE
  // ========================================================

  async function handleDelete(
    id: string
  ) {

    if (
      !confirm(
        'Delete this item?'
      )
    ) {

      return;

    }


    const {
      error,
    } = await supabase
      .from(
        'harvest_festival_items'
      )
      .delete()
      .eq(
        'id',
        id
      );


    if (error) {

      setError(
        error.message
      );

      return;

    }


    await fetchItems();

  }


  // ========================================================
  // START FULL EDIT
  // ========================================================

  function startEditDetails(
    item: any
  ) {

    setEditingDetailsId(
      item.id
    );


    // Full-details editing and settled-amount editing are separate.
    setEditingId(null);
    setEditSettled('');

    setEditItemName(
      item.item_name || ''
    );


    setEditConsignor(
      item.consignor || ''
    );


    setEditConsignorChurchId(
      item.consignor_church_id ||
      ''
    );


    setEditPurchasedPerson(
      item.purchased_person ||
      ''
    );


    setEditPurchasedPersonChurchId(
      item.purchased_person_church_id ||
      ''
    );


    setEditPurchasedPersonContact(
      item.purchased_person_contact ||
      ''
    );


    setEditAmount(
      String(
        item.amount ?? ''
      )
    );

  }


  // ========================================================
  // SAVE FULL EDIT
  // ========================================================

  async function saveEditDetails(item: any) {
    const itemName = editItemName.trim();
    const purchasedPerson = editPurchasedPerson.trim();
    const amount = Number(editAmount);

    if (!itemName) {
      setError('Item name cannot be empty.');
      return;
    }

    if (!purchasedPerson) {
      setError('Purchased-by person cannot be empty.');
      return;
    }

    if (
      editAmount.trim() === '' ||
      Number.isNaN(amount) ||
      amount < 0
    ) {
      setError('Please enter a valid amount.');
      return;
    }

    const settled =
      Number(item.settled_amount) || 0;

    const status =
      settled >= amount
        ? 'paid'
        : 'due';

    const { error } = await supabase
      .from('harvest_festival_items')
      .update({
        item_name: itemName,
        consignor:
          editConsignor.trim() || null,
        consignor_church_id:
          editConsignorChurchId || null,
        purchased_person: purchasedPerson,
        purchased_person_church_id:
          editPurchasedPersonChurchId || null,
        purchased_person_contact:
          editPurchasedPersonContact.trim() || null,
        amount,
        status,
      })
      .eq('id', item.id);

    if (error) {
      console.error(
        'Harvest Festival update error:',
        error
      );

      setError(error.message);
      return;
    }

    cancelEditDetails();
    await fetchItems();
  }

  // ========================================================
  // CANCEL FULL EDIT
  // ========================================================

  function cancelEditDetails() {

    setEditingDetailsId(
      null
    );

    setEditItemName('');
    setEditConsignor('');
    setEditConsignorChurchId('');
    setEditPurchasedPerson('');
    setEditPurchasedPersonChurchId('');
    setEditPurchasedPersonContact('');
    setEditAmount('');

  }


  // ========================================================
  // SETTLED AMOUNT EDIT
  // ========================================================

  function startEditSettled(
    item: HarvestFestivalItem
  ) {

    // Settled amount has its own independent edit mode.
    // Starting this edit always closes the full-details editor.
    setEditingDetailsId(null);

    setEditingId(item.id);

    setEditSettled(
      String(
        item.settled_amount ?? 0
      )
    );

    setError('');

  }


  async function saveEditSettled(
    item: HarvestFestivalItem
  ) {
    const rawSettled = editSettled.trim();

    if (rawSettled === '') {
      setError('Please enter a settled amount.');
      return;
    }

    const settled = Number(rawSettled);
    const amount = Number(item.amount) || 0;

    if (Number.isNaN(settled) || settled < 0) {
      setError('Settled amount cannot be negative.');
      return;
    }

    if (settled > amount) {
      setError(
        'Settled amount cannot be greater than the total amount.'
      );
      return;
    }

    const status =
      settled >= amount
        ? 'paid'
        : 'due';

    const { error } = await supabase
      .from('harvest_festival_items')
      .update({
        settled_amount: settled,
        status,
      })
      .eq('id', item.id);

    if (error) {
      console.error(
        'Harvest Festival settled amount update error:',
        error
      );

      setError(
        error.message ||
        'Failed to update settled amount.'
      );

      return;
    }

    // Close ONLY the settled amount editor.
    setEditingId(null);
    setEditSettled('');
    setError('');

    await fetchItems();
  }

  // ========================================================
  // CLEAR
  // ========================================================

  function handleClear() {

    setForm({

      item_name: '',

      consignor: '',

      consignor_church_id: '',

      purchased_person: '',

      purchased_person_church_id: '',

      purchased_person_contact: '',

      amount: '',

    });

  }


  // ========================================================
  // DELETE ALL
  // ========================================================

  async function handleDeleteAll() {

    if (!activeChurchId)
      return;


    if (
      !confirm(
        'Delete ALL harvest festival items for this church? This cannot be undone.'
      )
    ) {

      return;

    }


    const {
      error,
    } = await supabase
      .from(
        'harvest_festival_items'
      )
      .delete()
      .eq(
        'church_id',
        activeChurchId
      );


    if (error) {

      setError(
        error.message
      );

      return;

    }


    await fetchItems();

  }


  // ========================================================
  // SEARCH
  // ========================================================

  const filteredItems =
    useMemo(() => {

      if (
        !searchQuery.trim()
      ) {

        return items;

      }


      const q =
        searchQuery
          .trim()
          .toLowerCase();


      return items.filter(
        (item: any) => {

          const pending =
            Number(item.amount) -
            Number(
              item.settled_amount
            );


          return (

            (
              item.item_name ||
              ''
            )
              .toLowerCase()
              .includes(q)

            ||

            (
              item.consignor ||
              ''
            )
              .toLowerCase()
              .includes(q)

            ||

            (
              item.consignor_church
                ?.name ||
              ''
            )
              .toLowerCase()
              .includes(q)

            ||

            (
              item.purchased_person ||
              ''
            )
              .toLowerCase()
              .includes(q)

            ||

            (
              item.purchased_person_church
                ?.name ||
              ''
            )
              .toLowerCase()
              .includes(q)

            ||

            (
              item.purchased_person_contact ||
              ''
            )
              .toLowerCase()
              .includes(q)

            ||

            String(
              item.amount
            ).includes(q)

            ||

            String(
              item.settled_amount
            ).includes(q)

            ||

            String(
              pending
            ).includes(q)

          );

        }
      );

    }, [
      items,
      searchQuery,
    ]);


  // ========================================================
  // TOTALS
  // ========================================================

  const totalAmount =
    filteredItems.reduce(
      (sum, item) =>
        sum +
        Number(item.amount),
      0
    );


  const totalSettled =
    filteredItems.reduce(
      (sum, item) =>
        sum +
        Number(
          item.settled_amount
        ),
      0
    );


  const totalPending =
    totalAmount -
    totalSettled;


  // ========================================================
  // CSV
  // ========================================================

  function handleExportCSV() {

    const columns = [

      {
        key: 'item_name',
        label: 'Item Name',
      },

      {
        key: 'consignor',
        label: 'Consignor',
      },

      {
        key: 'consignor_church_name',
        label: 'Consignor Church',
      },

      {
        key: 'purchased_person',
        label: 'Purchased By',
      },

      {
        key: 'purchased_person_church_name',
        label: 'Purchased Person Church',
      },

      {
        key: 'purchased_person_contact',
        label: 'Contact Number',
      },

      {
        key: 'amount',
        label: 'Amount',
      },

      {
        key: 'status',
        label: 'Status',
      },

      {
        key: 'settled_amount',
        label: 'Settled Amount',
      },

      {
        key: 'pending_amount',
        label: 'Pending Amount',
      },

    ];


    const data =
      filteredItems.map(
        (item: any) => ({

          ...item,

          consignor_church_name:
            item
              .consignor_church
              ?.name || '',

          purchased_person_church_name:
            item
              .purchased_person_church
              ?.name || '',

          pending_amount:
            Number(item.amount) -
            Number(
              item.settled_amount
            ),

        })
      );


    const churchName =
      isSuperAdmin
        ? (
            selectedChurchId
              ? churches.find(
                  c =>
                    c.id ===
                    selectedChurchId
                )?.name || 'church'
              : 'all-churches'
          )
        : church?.name ||
          'church';


    exportToCSV(
      `harvest-festival-${churchName}-${new Date()
        .toISOString()
        .split('T')[0]}`,
      data,
      columns
    );

  }


  // ========================================================
  // PDF
  // ========================================================

  function handleExportPDF() {

    const churchName =
      isSuperAdmin
        ? churches.find(
            c =>
              c.id ===
              selectedChurchId
          )?.name ||
          'All Churches'
        : church?.name ||
          'Church';


    const rows =
      filteredItems.map(
        (item: any) => `

        <tr>

          <td>
            ${item.item_name || ''}
          </td>

          <td>
            ${item.consignor || ''}
          </td>

          <td>
            ${
              item.consignor_church
                ?.name || ''
            }
          </td>

          <td>
            ${
              item.purchased_person ||
              ''
            }
          </td>

          <td>
            ${
              item
                .purchased_person_church
                ?.name || ''
            }
          </td>

          <td>
            ${
              item
                .purchased_person_contact ||
              ''
            }
          </td>

          <td>
            ₹${Number(
              item.amount
            ).toLocaleString(
              'en-IN'
            )}
          </td>

          <td>
            ${
              item.status === 'paid'
                ? '<span style="color:green">Paid</span>'
                : '<span style="color:red">Due</span>'
            }
          </td>

          <td>
            ₹${Number(
              item.settled_amount
            ).toLocaleString(
              'en-IN'
            )}
          </td>

          <td>
            ₹${(
              Number(item.amount) -
              Number(
                item.settled_amount
              )
            ).toLocaleString(
              'en-IN'
            )}
          </td>

        </tr>

      `
      ).join('');


    const table = `

      <table
        style="
          width:100%;
          border-collapse:collapse;
        "
      >

        <thead>

          <tr>

            <th>Item</th>
            <th>Consignor</th>
            <th>Consignor Church</th>
            <th>Purchased By</th>
            <th>Purchased Church</th>
            <th>Contact</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Settled</th>
            <th>Pending</th>

          </tr>

        </thead>

        <tbody>

          ${rows}

          <tr
            style="
              font-weight:bold;
              background:#f0f0f0;
            "
          >

            <td colspan="6">
              Total
            </td>

            <td>
              ₹${totalAmount.toLocaleString(
                'en-IN'
              )}
            </td>

            <td></td>

            <td>
              ₹${totalSettled.toLocaleString(
                'en-IN'
              )}
            </td>

            <td>
              ₹${totalPending.toLocaleString(
                'en-IN'
              )}
            </td>

          </tr>

        </tbody>

      </table>

    `;


    generatePDF(
      `Harvest Festival - ${churchName}`,
      table,
      `harvest-festival-${churchName}`
    );

  }


  // ========================================================
  // UI
  // ========================================================

  return (

    <div>

      {/* HEADER */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">

        <div>

          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">

            <Wheat className="w-6 h-6 text-amber-600" />

            Harvest Festival

          </h1>


          <p className="text-slate-500 text-sm mt-0.5">

            {filteredItems.length} of {items.length}{' '}

            item
            {items.length !== 1
              ? 's'
              : ''}{' '}

            {searchQuery.trim()
              ? 'matching'
              : 'tracked'}

          </p>

        </div>


        <div className="flex items-center gap-2 flex-wrap">

          <button
            onClick={fetchItems}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >

            <RefreshCw className="w-4 h-4" />

            Refresh

          </button>


          {items.length > 0 && (

            <>

              <div className="flex items-center gap-2 border-l border-slate-300 pl-2">

                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition-colors border border-green-200"
                >

                  <Download className="w-4 h-4" />

                  CSV

                </button>


                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-sm font-medium transition-colors border border-orange-200"
                >

                  <FileText className="w-4 h-4" />

                  PDF

                </button>

              </div>


              <button
                onClick={handleDeleteAll}
                className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors border border-red-200"
              >

                <Trash2 className="w-4 h-4" />

                Delete All

              </button>

            </>

          )}

        </div>

      </div>


      {/* ERROR */}

      {error && (

        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2 mb-4">

          <AlertCircle className="w-4 h-4 flex-shrink-0" />

          {error}

        </div>

      )}


      {/* SUPER ADMIN CHURCH */}

      {isSuperAdmin && (

        <div className="mb-5">

          <label className="block text-sm font-medium text-slate-700 mb-1">

            Select Church

          </label>


          <select
            value={selectedChurchId}
            onChange={e =>
              setSelectedChurchId(
                e.target.value
              )
            }
            className="w-full max-w-xs px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          >

            <option value="">
              All Churches
            </option>


            {churches.map(c => (

              <option
                key={c.id}
                value={c.id}
              >

                {c.name}

              </option>

            ))}

          </select>

        </div>

      )}


      {/* ADD FORM */}

      <form
        onSubmit={handleAdd}
        className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6"
      >

        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">

          <Plus className="w-4 h-4 text-teal-600" />

          Add Item

        </h2>

        {isSuperAdmin && !selectedChurchId && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Select a specific church above before adding a harvest festival item.
          </div>
        )}


        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">


          {/* ITEM NAME */}

          <div>

            <label className="block text-sm font-medium text-slate-700 mb-1">

              Item Name

            </label>

            <input
              type="text"
              value={form.item_name}
              onChange={e =>
                setForm(f => ({
                  ...f,
                  item_name:
                    e.target.value,
                }))
              }
              placeholder="e.g. Rice, Vegetables"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            />

          </div>


          {/* CONSIGNOR */}

          <div>

            <label className="block text-sm font-medium text-slate-700 mb-1">

              Consignor

            </label>

            <input
              type="text"
              value={form.consignor}
              onChange={e =>
                setForm(f => ({
                  ...f,
                  consignor:
                    e.target.value,
                }))
              }
              placeholder="Consignor name"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            />

          </div>


          {/* CONSIGNOR CHURCH */}

          <div>

            <label className="block text-sm font-medium text-slate-700 mb-1">

              Consignor Church

            </label>

            <select
              value={
                form.consignor_church_id
              }
              onChange={e =>
                setForm(f => ({
                  ...f,
                  consignor_church_id:
                    e.target.value,
                }))
              }
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            >

              <option value="">
                Select Church
              </option>


              {churches.map(c => (

                <option
                  key={c.id}
                  value={c.id}
                >

                  {c.name}

                </option>

              ))}

            </select>

          </div>


          {/* PURCHASED PERSON */}

          <div>

            <label className="block text-sm font-medium text-slate-700 mb-1">

              Purchased By

            </label>

            <input
              type="text"
              value={
                form.purchased_person
              }
              onChange={e =>
                setForm(f => ({
                  ...f,
                  purchased_person:
                    e.target.value,
                }))
              }
              placeholder="Person name"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            />

          </div>


          {/* PURCHASED PERSON CHURCH */}

          <div>

            <label className="block text-sm font-medium text-slate-700 mb-1">

              Purchased Person Church

            </label>

            <select
              value={
                form.purchased_person_church_id
              }
              onChange={e =>
                setForm(f => ({
                  ...f,
                  purchased_person_church_id:
                    e.target.value,
                }))
              }
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            >

              <option value="">
                Select Church
              </option>


              {churches.map(c => (

                <option
                  key={c.id}
                  value={c.id}
                >

                  {c.name}

                </option>

              ))}

            </select>

          </div>


          {/* CONTACT */}

          <div>

            <label className="block text-sm font-medium text-slate-700 mb-1">

              Purchased Person Contact

            </label>

            <input
              type="tel"
              value={
                form.purchased_person_contact
              }
              onChange={e =>
                setForm(f => ({
                  ...f,
                  purchased_person_contact:
                    e.target.value,
                }))
              }
              placeholder="Contact number"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            />

          </div>


          {/* AMOUNT */}

          <div>

            <label className="block text-sm font-medium text-slate-700 mb-1">

              Amount

            </label>

            <div className="relative">

              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">

                ₹

              </span>


              <input
                type="number"
                value={form.amount}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    amount:
                      e.target.value,
                  }))
                }
                placeholder="0"
                min="0"
                step="0.01"
                className="w-full pl-7 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              />

            </div>

          </div>

        </div>


        <div className="flex items-center gap-3 mt-4">

          <button
            type="submit"
            disabled={
              saving ||
              (isSuperAdmin && !selectedChurchId)
            }
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
          >

            <Plus className="w-4 h-4" />

            {saving
              ? 'Adding...'
              : 'Add Item'}

          </button>


          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
          >

            <X className="w-4 h-4" />

            Clear

          </button>

        </div>

      </form>


      {/* SUMMARY CARDS */}

      {items.length > 0 && (

        <div className="grid grid-cols-3 gap-4 mb-6">

          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">

            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 opacity-70">

              Total Amount

            </p>

            <p className="text-xl font-bold text-amber-700 mt-1">

              ₹
              {totalAmount.toLocaleString(
                'en-IN'
              )}

            </p>

          </div>


          <div className="bg-green-50 rounded-xl border border-green-200 p-4">

            <p className="text-xs font-semibold uppercase tracking-wide text-green-600 opacity-70">

              Settled

            </p>

            <p className="text-xl font-bold text-green-700 mt-1">

              ₹
              {totalSettled.toLocaleString(
                'en-IN'
              )}

            </p>

          </div>


          <div className="bg-red-50 rounded-xl border border-red-200 p-4">

            <p className="text-xs font-semibold uppercase tracking-wide text-red-600 opacity-70">

              Pending

            </p>

            <p className="text-xl font-bold text-red-700 mt-1">

              ₹
              {totalPending.toLocaleString(
                'en-IN'
              )}

            </p>

          </div>

        </div>

      )}


      {/* SEARCH */}

      {items.length > 0 && (

        <div className="mb-4">

          <div className="relative max-w-md">

            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

            <input
              type="text"
              value={searchQuery}
              onChange={e =>
                setSearchQuery(
                  e.target.value
                )
              }
              placeholder="Search by item, church, consignor, purchaser or contact..."
              className="w-full pl-10 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            />


            {searchQuery && (

              <button
                onClick={() =>
                  setSearchQuery('')
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >

                <X className="w-4 h-4" />

              </button>

            )}

          </div>

        </div>

      )}


      {/* LOADING */}

      {loading ? (

        <div className="flex items-center justify-center h-48">

          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />

        </div>


      ) : filteredItems.length === 0 ? (

        <div className="flex flex-col items-center justify-center h-48 text-slate-400">

          <Wheat className="w-12 h-12 mb-3 opacity-40" />

          <p className="font-medium">
            No items yet
          </p>

          <p className="text-sm mt-1">
            Add items to track harvest festival purchases
          </p>

        </div>


      ) : (

        /* ==================================================
           TABLE
           ================================================== */

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead>

                <tr className="bg-slate-50 border-b border-slate-200">

                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Item
                  </th>

                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Consignor
                  </th>

                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Consignor Church
                  </th>

                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Purchased By
                  </th>

                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Purchased Church
                  </th>

                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contact
                  </th>

                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Amount
                  </th>

                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Settled
                  </th>

                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Pending
                  </th>

                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>

                </tr>

              </thead>


              <tbody className="divide-y divide-slate-100">

                {filteredItems.map(
                  (item: any) => {

                    const pending =
                      Number(
                        item.amount
                      ) -
                      Number(
                        item.settled_amount
                      );


                    const isEditingDetails =
                      editingDetailsId ===
                      item.id;


                    const isEditingSettled =
                      editingId ===
                      item.id;


                    return (

                      <tr
                        key={item.id}
                        className="hover:bg-slate-50 transition-colors"
                      >


                        {/* ITEM */}

                        <td className="px-4 py-3">

                          {isEditingDetails ? (

                            <input
                              type="text"
                              value={
                                editItemName
                              }
                              onChange={e =>
                                setEditItemName(
                                  e.target.value
                                )
                              }
                              className="w-32 px-2 py-1 border border-teal-400 rounded text-sm text-slate-800 focus:ring-1 focus:ring-teal-500 outline-none"
                            />

                          ) : (

                            <>

                              <p className="text-sm font-medium text-slate-800">

                                {item.item_name ||
                                  '—'}

                              </p>


                              {isSuperAdmin &&
                                item.church && (

                                  <p className="text-xs text-slate-400 mt-0.5">

                                    {
                                      item.church
                                        .name
                                    }

                                  </p>

                                )}

                            </>

                          )}

                        </td>


                        {/* CONSIGNOR */}

                        <td className="px-4 py-3">

                          {isEditingDetails ? (

                            <input
                              type="text"
                              value={
                                editConsignor
                              }
                              onChange={e =>
                                setEditConsignor(
                                  e.target.value
                                )
                              }
                              className="w-32 px-2 py-1 border border-teal-400 rounded text-sm text-slate-800 focus:ring-1 focus:ring-teal-500 outline-none"
                            />

                          ) : (

                            <span className="text-sm text-slate-700">

                              {item.consignor ||
                                '—'}

                            </span>

                          )}

                        </td>


                        {/* CONSIGNOR CHURCH */}

                        <td className="px-4 py-3">

                          {isEditingDetails ? (

                            <select
                              value={
                                editConsignorChurchId
                              }
                              onChange={e =>
                                setEditConsignorChurchId(
                                  e.target.value
                                )
                              }
                              className="w-40 px-2 py-1 border border-teal-400 rounded text-sm text-slate-800 bg-white focus:ring-1 focus:ring-teal-500 outline-none"
                            >

                              <option value="">
                                Select Church
                              </option>


                              {churches.map(
                                c => (

                                  <option
                                    key={c.id}
                                    value={c.id}
                                  >

                                    {c.name}

                                  </option>

                                )
                              )}

                            </select>

                          ) : (

                            <span className="text-sm text-slate-700">

                              {
                                item
                                  .consignor_church
                                  ?.name ||
                                '—'
                              }

                            </span>

                          )}

                        </td>


                        {/* PURCHASED BY */}

                        <td className="px-4 py-3">

                          {isEditingDetails ? (

                            <input
                              type="text"
                              value={
                                editPurchasedPerson
                              }
                              onChange={e =>
                                setEditPurchasedPerson(
                                  e.target.value
                                )
                              }
                              className="w-32 px-2 py-1 border border-teal-400 rounded text-sm text-slate-800 focus:ring-1 focus:ring-teal-500 outline-none"
                            />

                          ) : (

                            <span className="text-sm text-slate-700">

                              {
                                item.purchased_person ||
                                '—'
                              }

                            </span>

                          )}

                        </td>


                        {/* PURCHASED CHURCH */}

                        <td className="px-4 py-3">

                          {isEditingDetails ? (

                            <select
                              value={
                                editPurchasedPersonChurchId
                              }
                              onChange={e =>
                                setEditPurchasedPersonChurchId(
                                  e.target.value
                                )
                              }
                              className="w-40 px-2 py-1 border border-teal-400 rounded text-sm text-slate-800 bg-white focus:ring-1 focus:ring-teal-500 outline-none"
                            >

                              <option value="">
                                Select Church
                              </option>


                              {churches.map(
                                c => (

                                  <option
                                    key={c.id}
                                    value={c.id}
                                  >

                                    {c.name}

                                  </option>

                                )
                              )}

                            </select>

                          ) : (

                            <span className="text-sm text-slate-700">

                              {
                                item
                                  .purchased_person_church
                                  ?.name ||
                                '—'
                              }

                            </span>

                          )}

                        </td>


                        {/* CONTACT */}

                        <td className="px-4 py-3">

                          {isEditingDetails ? (

                            <input
                              type="tel"
                              value={
                                editPurchasedPersonContact
                              }
                              onChange={e =>
                                setEditPurchasedPersonContact(
                                  e.target.value
                                )
                              }
                              className="w-32 px-2 py-1 border border-teal-400 rounded text-sm text-slate-800 focus:ring-1 focus:ring-teal-500 outline-none"
                            />

                          ) : (

                            <span className="text-sm text-slate-700">

                              {
                                item
                                  .purchased_person_contact ||
                                '—'
                              }

                            </span>

                          )}

                        </td>


                        {/* AMOUNT */}

                        <td className="px-4 py-3 text-right">

                          {isEditingDetails ? (

                            <div className="relative">

                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                                ₹
                              </span>


                              <input
                                type="number"
                                value={
                                  editAmount
                                }
                                onChange={e =>
                                  setEditAmount(
                                    e.target.value
                                  )
                                }
                                min="0"
                                step="0.01"
                                className="w-24 pl-5 pr-2 py-1 border border-teal-400 rounded text-sm text-slate-800 focus:ring-1 focus:ring-teal-500 outline-none"
                              />

                            </div>

                          ) : (

                            <span className="text-sm text-slate-800 font-medium">

                              ₹
                              {Number(
                                item.amount
                              ).toLocaleString(
                                'en-IN'
                              )}

                            </span>

                          )}

                        </td>


                        {/* STATUS */}

                        <td className="px-4 py-3 text-center">

                          <button
                            onClick={() =>
                              handleStatusChange(
                                item.id,
                                item.status ===
                                  'paid'
                                  ? 'due'
                                  : 'paid'
                              )
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                              item.status ===
                              'paid'
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            }`}
                          >

                            {item.status ===
                            'paid' ? (

                              <CheckCircle className="w-3 h-3" />

                            ) : (

                              <Clock className="w-3 h-3" />

                            )}


                            {item.status ===
                            'paid'
                              ? 'Paid'
                              : 'Due'}

                          </button>

                        </td>


                        {/* SETTLED */}

                        <td className="px-4 py-3 text-right">

                          {isEditingSettled ? (

                            <div className="flex flex-col items-end gap-1.5">

                              <div className="flex items-center gap-1 justify-end">

                                <span className="text-xs text-slate-400">
                                  ₹
                                </span>

                                <input
                                  type="number"
                                  value={editSettled}
                                  onChange={e =>
                                    setEditSettled(
                                      e.target.value
                                    )
                                  }
                                  min="0"
                                  max={Number(item.amount) || 0}
                                  step="0.01"
                                  className="w-24 px-2 py-1 border border-teal-400 rounded text-sm text-slate-800 focus:ring-1 focus:ring-teal-500 outline-none"
                                  autoFocus
                                  onKeyDown={e => {

                                    if (
                                      e.key ===
                                      'Enter'
                                    ) {

                                      e.preventDefault();

                                      saveEditSettled(
                                        item
                                      );

                                    }

                                    if (
                                      e.key ===
                                      'Escape'
                                    ) {

                                      setEditingId(
                                        null
                                      );

                                      setEditSettled(
                                        ''
                                      );

                                    }

                                  }}
                                />

                                <button
                                  type="button"
                                  onClick={() =>
                                    saveEditSettled(
                                      item
                                    )
                                  }
                                  className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors"
                                  title="Save settled amount"
                                >

                                  <Save className="w-3.5 h-3.5" />

                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditSettled('');
                                  }}
                                  className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors"
                                  title="Cancel settled amount edit"
                                >

                                  <X className="w-3.5 h-3.5" />

                                </button>

                              </div>

                              <span className="text-[10px] text-slate-400">
                                Max: ₹
                                {Number(
                                  item.amount
                                ).toLocaleString(
                                  'en-IN'
                                )}
                              </span>

                            </div>

                          ) : (

                            <div className="flex flex-col items-end gap-1">

                              <span className="text-sm text-green-700 font-medium">

                                ₹
                                {Number(
                                  item.settled_amount
                                ).toLocaleString(
                                  'en-IN'
                                )}

                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  startEditSettled(
                                    item
                                  )
                                }
                                className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-800 hover:underline transition-colors"
                                title="Edit settled amount"
                              >

                                <Edit3 className="w-3 h-3" />

                                Edit Settled

                              </button>

                            </div>

                          )}

                        </td>


                        {/* PENDING */}

                        <td className="px-4 py-3 text-right">

                          <span
                            className={`text-sm font-medium ${
                              pending > 0
                                ? 'text-red-600'
                                : 'text-green-600'
                            }`}
                          >

                            ₹
                            {pending.toLocaleString(
                              'en-IN'
                            )}

                          </span>

                        </td>


                        {/* ACTIONS */}

                        <td className="px-4 py-3">

                          <div className="flex items-center justify-center gap-1">

                            {isEditingDetails ? (

                              <>

                                <button
                                  onClick={() =>
                                    saveEditDetails(
                                      item
                                    )
                                  }
                                  className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                                  title="Save changes"
                                >

                                  <Save className="w-3.5 h-3.5" />

                                </button>


                                <button
                                  onClick={
                                    cancelEditDetails
                                  }
                                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                                  title="Cancel"
                                >

                                  <X className="w-3.5 h-3.5" />

                                </button>

                              </>

                            ) : (

                              <>

                                <button
                                  onClick={() =>
                                    startEditDetails(
                                      item
                                    )
                                  }
                                  className="p-1.5 rounded-lg hover:bg-teal-50 text-teal-600 transition-colors"
                                  title="Edit all details"
                                >

                                  <Edit3 className="w-3.5 h-3.5" />

                                </button>


                                <button
                                  onClick={() =>
                                    handleDelete(
                                      item.id
                                    )
                                  }
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                                  title="Delete"
                                >

                                  <Trash2 className="w-3.5 h-3.5" />

                                </button>

                              </>

                            )}

                          </div>

                        </td>

                      </tr>

                    );

                  }
                )}

              </tbody>


              {/* TOTAL */}

              <tfoot>

                <tr className="bg-slate-50 border-t border-slate-200">

                  <td
                    colSpan={6}
                    className="px-4 py-3 text-sm font-bold text-slate-800"
                  >

                    Total

                  </td>


                  <td className="px-4 py-3 text-sm font-bold text-slate-800 text-right">

                    ₹
                    {totalAmount.toLocaleString(
                      'en-IN'
                    )}

                  </td>


                  <td></td>


                  <td className="px-4 py-3 text-sm font-bold text-green-700 text-right">

                    ₹
                    {totalSettled.toLocaleString(
                      'en-IN'
                    )}

                  </td>


                  <td className="px-4 py-3 text-sm font-bold text-right">

                    <span
                      className={
                        totalPending > 0
                          ? 'text-red-600'
                          : 'text-green-600'
                      }
                    >

                      ₹
                      {totalPending.toLocaleString(
                        'en-IN'
                      )}

                    </span>

                  </td>


                  <td></td>

                </tr>

              </tfoot>

            </table>

          </div>

        </div>

      )}

    </div>

  );

}