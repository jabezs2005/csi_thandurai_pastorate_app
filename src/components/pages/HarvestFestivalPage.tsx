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


// ============================================================
// HELPERS
// ============================================================

/**
 * Normalizes item names for duplicate detection.
 *
 * Examples treated as duplicates:
 * Rice
 * RICE
 * rice
 * Rice-Bag
 * rice bag
 * RICE_BAG
 * RiceBag
 *
 * Spaces, punctuation and capitalization are ignored.
 */
function normalizeItemName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}


/**
 * Normalizes item numbers for duplicate detection.
 * Item numbers are compared case-insensitively and
 * surrounding whitespace is ignored.
 */
function normalizeItemNumber(value: string): string {
  return value.trim().toLowerCase();
}


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
    item_number: '',
    item_name: '',
    actual_price: '',
    consignor: '',
    consignor_church_id: '',
    purchased_person: '',
    purchased_person_church_id: '',
    purchased_person_contact: '',
    amount: '',
    payment_method: 'Cash',
    remarks: '',
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

  const [editItemNumber, setEditItemNumber] =
    useState('');

  const [editItemName, setEditItemName] =
    useState('');

  const [editActualPrice, setEditActualPrice] =
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

  const [editPaymentMethod, setEditPaymentMethod] =
    useState<
      'Cash' |
      'GPay' |
      'Token' |
      'Cash,Token' |
      'GPay,Token' |
      'GPay,Cash'
    >('Cash');

  const [editRemarks, setEditRemarks] =
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

  // Prevent the automatic data-loading effect from firing again
  // because of unrelated component re-renders. Manual Refresh and
  // post-save/post-edit/post-delete refreshes still call fetchItems().
  const lastAutoLoadedKeyRef =
    useRef('');


  // ========================================================
  // DUPLICATE CHECKS - ADD FORM
  // ========================================================

  const duplicateItemNumber = useMemo(() => {

    const value =
      normalizeItemNumber(form.item_number);

    if (!value) {
      return false;
    }

    return items.some(
      (item: any) =>
        normalizeItemNumber(
          String(item.item_number || '')
        ) === value
    );

  }, [
    items,
    form.item_number,
  ]);


  const duplicateItemName = useMemo(() => {

    const value =
      normalizeItemName(form.item_name);

    if (!value) {
      return false;
    }

    return items.some(
      (item: any) =>
        normalizeItemName(
          String(item.item_name || '')
        ) === value
    );

  }, [
    items,
    form.item_name,
  ]);


  // ========================================================
  // ITEM NUMBER SERIES
  // ========================================================

  const availableItemNumbers = useMemo(() => {

    const used = new Set(
      items
        .map((item: any) =>
          normalizeItemNumber(
            String(item.item_number || '')
          )
        )
        .filter(Boolean)
    );

    return Array.from(
      { length: 999 },
      (_, index) =>
        String(index + 1).padStart(3, '0')
    ).filter(
      number =>
        !used.has(
          normalizeItemNumber(number)
        ) ||
        normalizeItemNumber(number) ===
          normalizeItemNumber(form.item_number)
    );

  }, [
    items,
    form.item_number,
  ]);


  const availableEditItemNumbers = useMemo(() => {

    const used = new Set(
      items
        .filter((item: any) =>
          item.id !== editingDetailsId
        )
        .map((item: any) =>
          normalizeItemNumber(
            String(item.item_number || '')
          )
        )
        .filter(Boolean)
    );

    const current =
      normalizeItemNumber(editItemNumber);

    return Array.from(
      { length: 999 },
      (_, index) =>
        String(index + 1).padStart(3, '0')
    ).filter(
      number =>
        !used.has(
          normalizeItemNumber(number)
        ) ||
        normalizeItemNumber(number) === current
    );

  }, [
    items,
    editItemNumber,
    editingDetailsId,
  ]);


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

    const loadKey = [
      profile.id || '',
      isSuperAdmin ? 'super' : 'church',
      isSuperAdmin ? selectedChurchId : churchId,
    ].join('|');

    if (
      lastAutoLoadedKeyRef.current ===
      loadKey
    ) {
      return;
    }

    lastAutoLoadedKeyRef.current =
      loadKey;

    fetchItems();

  }, [
    profile,
    initialized,
    isSuperAdmin,
    selectedChurchId,
    churchId,
    fetchItems,
  ]);




  // ========================================================
  // ADD ITEM
  // ========================================================

  async function handleAdd(
    e: React.FormEvent
  ) {

    e.preventDefault();

    setSaving(true);
    setError('');


    const cId =
      isSuperAdmin
        ? selectedChurchId
        : churchId;


    if (!cId) {

      setError(
        'Please select a church.'
      );

      setSaving(false);

      return;
    }


    const itemNumber =
      form.item_number.trim();

    const itemName =
      form.item_name.trim();

    const actualPrice =
      form.actual_price.trim() === ''
        ? null
        : Number(form.actual_price);

    const purchasedPerson =
      form.purchased_person.trim();

    const amount =
      form.amount.trim() === ''
        ? null
        : Number(form.amount);

    const remarks =
      form.remarks.trim();


    // Item Number is the ONLY required field.
    if (!itemNumber) {

      setError(
        'Please enter the item number.'
      );

      setSaving(false);

      return;
    }


    // Duplicate Item Number is NOT allowed.
    if (duplicateItemNumber) {

      setError(
        `Item number "${itemNumber}" already exists. Please enter a different item number.`
      );

      setSaving(false);

      return;
    }


    // Optional numeric fields must still be valid
    // if the user entered something.
    if (
      actualPrice !== null &&
      (Number.isNaN(actualPrice) ||
        actualPrice < 0)
    ) {

      setError(
        'Please enter a valid Actual Price.'
      );

      setSaving(false);

      return;
    }


    if (
      amount !== null &&
      (Number.isNaN(amount) ||
        amount < 0)
    ) {

      setError(
        'Please enter a valid Purchased Amount.'
      );

      setSaving(false);

      return;
    }


    // Re-check the database immediately before insert so that
    // another user cannot select the same number unnoticed.
    const { data: existingNumberRows, error: duplicateQueryError } =
      await supabase
        .from('harvest_festival_items')
        .select('id,item_number')
        .eq('church_id', cId)
        .ilike('item_number', itemNumber)
        .limit(1);

    if (duplicateQueryError) {
      console.error(
        'Harvest Festival duplicate number check error:',
        duplicateQueryError
      );

      setError(duplicateQueryError.message);
      setSaving(false);
      return;
    }

    if ((existingNumberRows || []).some(
      (row: any) =>
        normalizeItemNumber(
          String(row.item_number || '')
        ) === normalizeItemNumber(itemNumber)
    )) {
      setError(
        `Item number "${itemNumber}" has already been selected by another user. Please choose another number.`
      );
      await fetchItems();
      setSaving(false);
      return;
    }


    try {

      const { error: insertError } =
        await supabase
          .from('harvest_festival_items')
          .insert({

            church_id: cId,

            item_number:
              itemNumber,

            item_name:
              itemName || null,

            actual_price:
              actualPrice,

            consignor:
              form.consignor.trim() ||
              null,

            consignor_church_id:
              form.consignor_church_id ||
              null,

            purchased_person:
              purchasedPerson ||
              null,

            purchased_person_church_id:
              form.purchased_person_church_id ||
              null,

            purchased_person_contact:
              form.purchased_person_contact.trim() ||
              null,

            amount:
              amount,

            payment_method:
              form.payment_method ||
              null,

            remarks:
              remarks || null,

            status:
              amount !== null
                ? 'due'
                : null,

            settled_amount:
              amount !== null
                ? 0
                : null,

          });


      if (insertError) {

        throw insertError;

      }


      setForm({

        item_number: '',

        item_name: '',

        actual_price: '',

        consignor: '',

        consignor_church_id: '',

        purchased_person: '',

        purchased_person_church_id: '',

        purchased_person_contact: '',

        amount: '',

        payment_method: 'Cash',
        remarks: '',

      });


      await fetchItems();

    } catch (
      err: any
    ) {

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

    const item =
      items.find(
        i => i.id === id
      );


    if (!item) {

      setError(
        'Item not found.'
      );

      return;
    }


    const amount =
      Number(
        (item as any).amount || 0
      );


    const updates: {
      status: 'paid' | 'due';
      settled_amount?: number;
    } = {
      status,
    };


    if (status === 'paid') {

      updates.settled_amount =
        amount;

    }


    const { error } =
      await supabase
        .from(
          'harvest_festival_items'
        )
        .update(updates)
        .eq(
          'id',
          id
        );


    if (error) {

      console.error(
        'Harvest Festival status update error:',
        error
      );

      setError(
        error.message
      );

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


    // Full-details editing and
    // settled-amount editing are separate.
    setEditingId(null);
    setEditSettled('');


    setEditItemNumber(
      item.item_number || ''
    );


    setEditItemName(
      item.item_name || ''
    );


    setEditActualPrice(
      item.actual_price === null ||
      item.actual_price === undefined
        ? ''
        : String(item.actual_price)
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
      item.amount === null ||
      item.amount === undefined
        ? ''
        : String(item.amount)
    );


    setEditPaymentMethod(
      item.payment_method === 'GPay'
        ? 'GPay'
        : item.payment_method === 'Token'
          ? 'Token'
          : item.payment_method === 'Cash,Token'
            ? 'Cash,Token'
            : item.payment_method === 'GPay,Token'
              ? 'GPay,Token'
              : item.payment_method === 'GPay,Cash'
                ? 'GPay,Cash'
                : 'Cash'
    );

    setEditRemarks(item.remarks || '');

    setError('');

  }


  // ========================================================
  // EDIT DUPLICATE CHECKS
  // ========================================================

  const hasDuplicateEditItemNumber = useMemo(() => {

    const value =
      normalizeItemNumber(
        editItemNumber
      );


    if (!value) {
      return false;
    }


    return items.some(
      (item: any) =>
        item.id !== editingDetailsId &&
        normalizeItemNumber(
          String(item.item_number || '')
        ) === value
    );

  }, [
    items,
    editItemNumber,
    editingDetailsId,
  ]);


  const hasDuplicateEditItemName = useMemo(() => {

    const value =
      normalizeItemName(
        editItemName
      );


    if (!value) {
      return false;
    }


    return items.some(
      (item: any) =>
        item.id !== editingDetailsId &&
        normalizeItemName(
          String(item.item_name || '')
        ) === value
    );

  }, [
    items,
    editItemName,
    editingDetailsId,
  ]);


  // ========================================================
  // SAVE FULL EDIT
  // ========================================================

  async function saveEditDetails(
    item: any
  ) {

    const itemNumber =
      editItemNumber.trim();

    const itemName =
      editItemName.trim();

    const actualPrice =
      editActualPrice.trim() === ''
        ? null
        : Number(editActualPrice);

    const purchasedPerson =
      editPurchasedPerson.trim();

    const amount =
      editAmount.trim() === ''
        ? null
        : Number(editAmount);

    const remarks =
      editRemarks.trim();


    // Item Number remains the ONLY required field.
    if (!itemNumber) {

      setError(
        'Item number cannot be empty.'
      );

      return;
    }


    // Duplicate Item Number is not allowed.
    if (hasDuplicateEditItemNumber) {

      setError(
        `Item number "${itemNumber}" already exists. Please enter a different item number.`
      );

      return;
    }


    if (
      actualPrice !== null &&
      (Number.isNaN(actualPrice) ||
        actualPrice < 0)
    ) {

      setError(
        'Please enter a valid Actual Price.'
      );

      return;
    }


    if (
      amount !== null &&
      (Number.isNaN(amount) ||
        amount < 0)
    ) {

      setError(
        'Please enter a valid Purchased Amount.'
      );

      return;
    }


    const settled =
      Number(
        item.settled_amount || 0
      );


    const numericAmount =
      amount === null
        ? 0
        : amount;


    const safeSettled =
      Math.min(
        settled,
        numericAmount
      );


    const status =
      amount !== null &&
      safeSettled >= numericAmount
        ? 'paid'
        : 'due';


    const { error } =
      await supabase
        .from(
          'harvest_festival_items'
        )
        .update({

          item_number:
            itemNumber,

          item_name:
            itemName || null,

          actual_price:
            actualPrice,

          consignor:
            editConsignor.trim() ||
            null,

          consignor_church_id:
            editConsignorChurchId ||
            null,

          purchased_person:
            purchasedPerson ||
            null,

          purchased_person_church_id:
            editPurchasedPersonChurchId ||
            null,

          purchased_person_contact:
            editPurchasedPersonContact.trim() ||
            null,

          amount:
            amount,

          payment_method:
            editPaymentMethod ||
            null,

          remarks:
            remarks || null,

          status,

          settled_amount:
            amount === null
              ? null
              : safeSettled,

        })
        .eq(
          'id',
          item.id
        );


    if (error) {

      console.error(
        'Harvest Festival update error:',
        error
      );

      setError(
        error.message
      );

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

    setEditItemNumber('');

    setEditItemName('');

    setEditActualPrice('');

    setEditConsignor('');

    setEditConsignorChurchId('');

    setEditPurchasedPerson('');

    setEditPurchasedPersonChurchId('');

    setEditPurchasedPersonContact('');

    setEditAmount('');

    setEditPaymentMethod('Cash');
    setEditRemarks('');

    setError('');

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
        (item as any).settled_amount ?? 0
      )
    );

    setError('');

  }


  async function saveEditSettled(
    item: HarvestFestivalItem
  ) {

    const rawSettled =
      editSettled.trim();


    if (rawSettled === '') {

      setError(
        'Please enter a settled amount.'
      );

      return;
    }


    const settled =
      Number(rawSettled);


    const rawAmount =
      (item as any).amount;


    const amount =
      rawAmount === null ||
      rawAmount === undefined ||
      rawAmount === ''
        ? 0
        : Number(rawAmount);


    if (
      Number.isNaN(settled) ||
      settled < 0
    ) {

      setError(
        'Settled amount cannot be negative.'
      );

      return;
    }


    if (
      settled > amount
    ) {

      setError(
        'Settled amount cannot be greater than the total amount.'
      );

      return;
    }


    const status =
      settled >= amount &&
      amount > 0
        ? 'paid'
        : 'due';


    const { error } =
      await supabase
        .from(
          'harvest_festival_items'
        )
        .update({

          settled_amount:
            settled,

          status,

        })
        .eq(
          'id',
          item.id
        );


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

      item_number: '',

      item_name: '',

      actual_price: '',

      consignor: '',

      consignor_church_id: '',

      purchased_person: '',

      purchased_person_church_id: '',

      purchased_person_contact: '',

      amount: '',

      payment_method: 'Cash',
      remarks: '',

    });

    setError('');

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
            Number(item.amount || 0) -
            Number(
              item.settled_amount || 0
            );


          return (

            String(
              item.item_number ||
              ''
            )
              .toLowerCase()
              .includes(q)

            ||

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
              item.actual_price ?? ''
            ).includes(q)

            ||

            String(
              item.amount ?? ''
            ).includes(q)

            ||

            String(
              item.settled_amount ?? ''
            ).includes(q)

            ||

            String(
              pending
            ).includes(q)

            ||

            (item.payment_method || '')
              .toLowerCase()
              .includes(q)

            ||

            (item.remarks || '')
              .toLowerCase()
              .includes(q)

          );

        }
      );

    }, [
      items,
      searchQuery,
    ]);


  const sortedFilteredItems =
    useMemo(() => {

      return [...filteredItems].sort(
        (a: any, b: any) => {

          const aNumber =
            Number.parseInt(
              String(a.item_number || '')
                .replace(/\D/g, ''),
              10
            );

          const bNumber =
            Number.parseInt(
              String(b.item_number || '')
                .replace(/\D/g, ''),
              10
            );

          const aHasNumber =
            Number.isFinite(aNumber);

          const bHasNumber =
            Number.isFinite(bNumber);

          if (aHasNumber && bHasNumber) {
            if (aNumber !== bNumber) {
              return aNumber - bNumber;
            }

            return String(
              a.item_number || ''
            ).localeCompare(
              String(b.item_number || ''),
              undefined,
              { numeric: true }
            );
          }

          if (aHasNumber) return -1;
          if (bHasNumber) return 1;

          return String(
            a.item_number || ''
          ).localeCompare(
            String(b.item_number || ''),
            undefined,
            { numeric: true }
          );
        }
      );

    }, [filteredItems]);


  // ========================================================
  // TOTALS
  // ========================================================

  const totalActualPrice =
    filteredItems.reduce(
      (sum, item: any) =>
        sum +
        Number(
          item.actual_price || 0
        ),
      0
    );


  const totalAmount =
    filteredItems.reduce(
      (sum, item: any) =>
        sum +
        Number(
          item.amount || 0
        ),
      0
    );


  const totalSettled =
    filteredItems.reduce(
      (sum, item: any) =>
        sum +
        Number(
          item.settled_amount || 0
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
        key: 'item_number',
        label: 'Item Number',
      },

      {
        key: 'item_name',
        label: 'Item Name',
      },

      {
        key: 'actual_price',
        label: 'Actual Price',
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
        label: 'Purchased Amount',
      },

      {
        key: 'payment_method',
        label: 'Payment Method',
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

      {
        key: 'remarks',
        label: 'Remarks',
      },

    ];


    const data =
      sortedFilteredItems.map(
        (item: any) => ({

          ...item,

          actual_price:
            item.actual_price ??
            '',

          consignor_church_name:
            item
              .consignor_church
              ?.name || '',

          purchased_person_church_name:
            item
              .purchased_person_church
              ?.name || '',

          pending_amount:
            Number(item.amount || 0) -
            Number(
              item.settled_amount || 0
            ),

          remarks:
            item.remarks ?? '',

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
                )?.name ||
                'church'
              : 'all-churches'
          )
        : church?.name ||
          'church';


    const csvData = [
      ...data,
      {
        item_number: 'GRAND TOTAL',
        item_name: '',
        actual_price: totalActualPrice,
        amount: totalAmount,
        settled_amount: totalSettled,
        pending_amount: totalPending,
        remarks: '',
      },
    ];


    exportToCSV(
      `harvest-festival-${churchName}-${new Date()
        .toISOString()
        .split('T')[0]}`,
      csvData,
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
      sortedFilteredItems.map(
        (item: any) => `

        <tr>

          <td>
            ${item.item_number || ''}
          </td>

          <td>
            ${item.item_name || ''}
          </td>

          <td>
            ${
              item.actual_price !== null &&
              item.actual_price !== undefined &&
              item.actual_price !== ''
                ? `₹${Number(
                    item.actual_price
                  ).toLocaleString(
                    'en-IN'
                  )}`
                : ''
            }
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
            ${
              item.amount !== null &&
              item.amount !== undefined &&
              item.amount !== ''
                ? `₹${Number(
                    item.amount
                  ).toLocaleString(
                    'en-IN'
                  )}`
                : ''
            }
          </td>

          <td>
            ${item.payment_method || ''}
          </td>

          <td>
            ${
              item.status === 'paid'
                ? '<span style="color:green">Paid</span>'
                : item.amount !== null &&
                  item.amount !== undefined &&
                  item.amount !== ''
                  ? '<span style="color:red">Due</span>'
                  : ''
            }
          </td>

          <td>
            ${
              item.settled_amount !== null &&
              item.settled_amount !== undefined &&
              item.settled_amount !== ''
                ? `₹${Number(
                    item.settled_amount
                  ).toLocaleString(
                    'en-IN'
                  )}`
                : ''
            }
          </td>

          <td>
            ${
              item.amount !== null &&
              item.amount !== undefined &&
              item.amount !== ''
                ? `₹${(
                    Number(item.amount || 0) -
                    Number(
                      item.settled_amount || 0
                    )
                  ).toLocaleString(
                    'en-IN'
                  )}`
                : ''
            }
          </td>

          <td>
            ${item.remarks || ''}
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

            <th>Item Number</th>
            <th>Item Name</th>
            <th>Actual Price</th>
            <th>Consignor</th>
            <th>Consignor Church</th>
            <th>Purchased By</th>
            <th>Purchased Church</th>
            <th>Contact</th>
            <th>Purchased Amount</th>
            <th>Payment Method</th>
            <th>Status</th>
            <th>Settled</th>
            <th>Pending</th>
            <th>Remarks</th>

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

            <td colspan="2">
              Grand Total
            </td>

            <td>
              ₹${totalActualPrice.toLocaleString(
                'en-IN'
              )}
            </td>

            <td colspan="5"></td>

            <td>
              ₹${totalAmount.toLocaleString(
                'en-IN'
              )}
            </td>

            <td></td>

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

            <td></td>

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


          {/* ITEM NUMBER */}

          <div>

            <label className="block text-sm font-medium text-slate-700 mb-1">

              Item Number{' '}

              <span className="text-red-500">
                *
              </span>

            </label>


            <select
              value={form.item_number}
              onChange={e =>
                setForm(f => ({
                  ...f,
                  item_number: e.target.value,
                }))
              }
              className={`w-full px-3 py-2.5 border rounded-lg text-slate-800 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none ${
                duplicateItemNumber
                  ? 'border-red-400 bg-red-50'
                  : 'border-slate-300'
              }`}
              required
            >

              <option value="">
                Select Item Number
              </option>

              {availableItemNumbers.map(
                number => (
                  <option
                    key={number}
                    value={number}
                  >
                    {number}
                  </option>
                )
              )}

            </select>

            <p className="text-[11px] text-slate-400 mt-1">
              Numbers already used by this church are hidden.
            </p>

            {duplicateItemNumber && (

              <p className="text-xs text-red-600 mt-1 font-medium">

                Item number already exists.

              </p>

            )}

          </div>


          {/* ITEM NAME */}

          <div>

            <label className="block text-sm font-medium text-slate-700 mb-1">

              Item Name{' '}

              <span className="text-xs text-slate-400 font-normal">
                (Optional)
              </span>

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
              className={`w-full px-3 py-2.5 border rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none ${
                duplicateItemName
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-slate-300'
              }`}
            />


            {duplicateItemName && (

              <p className="text-xs text-amber-600 mt-1 font-medium">

                Duplicate item name already exists.

              </p>

            )}

          </div>


          {/* ACTUAL PRICE */}

          <div>

            <label className="block text-sm font-medium text-slate-700 mb-1">

              Actual Price{' '}

              <span className="text-xs text-slate-400 font-normal">
                (Optional)
              </span>

            </label>


            <div className="relative">

              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">

                ₹

              </span>


              <input
                type="number"
                value={form.actual_price}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    actual_price:
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


          {/* CONSIGNOR */}

          <div>

            <label className="block text-sm font-medium text-slate-700 mb-1">

              Consignor{' '}

              <span className="text-xs text-slate-400 font-normal">
                (Optional)
              </span>

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

              Consignor Church{' '}

              <span className="text-xs text-slate-400 font-normal">
                (Optional)
              </span>

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

              Purchased By{' '}

              <span className="text-xs text-slate-400 font-normal">
                (Optional)
              </span>

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

              Purchased Person Church{' '}

              <span className="text-xs text-slate-400 font-normal">
                (Optional)
              </span>

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

              Purchased Person Contact{' '}

              <span className="text-xs text-slate-400 font-normal">
                (Optional)
              </span>

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

              Purchased Amount{' '}

              <span className="text-xs text-slate-400 font-normal">
                (Optional)
              </span>

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


          {/* PAYMENT METHOD */}

          <div>

            <label className="block text-sm font-medium text-slate-700 mb-1">

              Payment Method{' '}

              <span className="text-xs text-slate-400 font-normal">
                (Optional)
              </span>

            </label>


            <select
              value={
                form.payment_method
              }
              onChange={e =>
                setForm(f => ({
                  ...f,
                  payment_method:
                    e.target.value,
                }))
              }
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            >

              <option value="">
                Select Payment Method
              </option>

              <option value="Cash">
                Cash
              </option>

              <option value="GPay">
                GPay
              </option>

              <option value="Token">
                Token
              </option>

              <option value="Cash,Token">
                Cash, Token
              </option>

              <option value="GPay,Token">
                GPay, Token
              </option>

              <option value="GPay,Cash">
                GPay, Cash
              </option>

            </select>

          </div>

          {/* REMARKS */}

          <div>

            <label className="block text-sm font-medium text-slate-700 mb-1">

              Remarks{' '}

              <span className="text-xs text-slate-400 font-normal">
                (Optional)
              </span>

            </label>

            <input
              type="text"
              value={form.remarks}
              onChange={e =>
                setForm(f => ({
                  ...f,
                  remarks: e.target.value,
                }))
              }
              placeholder="Remarks"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            />

          </div>

        </div>


        <div className="flex items-center gap-3 mt-4">

          <button
            type="submit"
            disabled={
              saving ||
              duplicateItemNumber ||
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">

          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">

            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 opacity-70">
              Grand Total Actual Price
            </p>

            <p className="text-xl font-bold text-blue-700 mt-1">
              ₹
              {totalActualPrice.toLocaleString(
                'en-IN'
              )}
            </p>

          </div>


          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">

            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 opacity-70">

              Total Purchased Amount

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
              placeholder="Search by item number, item, church, consignor, purchaser, contact, payment method or remarks..."
              className="w-full pl-10 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            />


            {searchQuery && (

              <button
                type="button"
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead>

                <tr className="bg-slate-50 border-b border-slate-200">

                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Item Number
                  </th>

                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Item Name
                  </th>

                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actual Price
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
                    PURCHASED AMOUNT
                  </th>

                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Payment Method
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

                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Remarks
                  </th>

                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>

                </tr>

              </thead>


              <tbody className="divide-y divide-slate-100">

                {sortedFilteredItems.map(
                  (item: any) => {

                    const pending =
                      Number(
                        item.amount || 0
                      ) -
                      Number(
                        item.settled_amount || 0
                      );


                    const isEditingDetails =
                      editingDetailsId ===
                      item.id;


                    const isEditingSettled =
                      editingId ===
                      item.id;


                    const itemNameIsDuplicate =
                      items.some(
                        (other: any) =>
                          other.id !== item.id &&
                          normalizeItemName(
                            String(
                              other.item_name || ''
                            )
                          ) !== '' &&
                          normalizeItemName(
                            String(
                              other.item_name || ''
                            )
                          ) ===
                            normalizeItemName(
                              String(
                                item.item_name || ''
                              )
                            )
                      );


                    return (

                      <tr
                        key={item.id}
                        className="hover:bg-slate-50 transition-colors"
                      >


                        {/* ITEM NUMBER */}

                        <td className="px-4 py-3">

                          {isEditingDetails ? (

                            <div>

                              <select
                                value={editItemNumber}
                                onChange={e =>
                                  setEditItemNumber(
                                    e.target.value
                                  )
                                }
                                className={`w-28 px-2 py-1 border rounded text-sm text-slate-800 bg-white focus:ring-1 focus:ring-teal-500 outline-none ${
                                  hasDuplicateEditItemNumber
                                    ? 'border-red-400 bg-red-50'
                                    : 'border-teal-400'
                                }`}
                              >

                                <option value="">
                                  Select
                                </option>

                                {availableEditItemNumbers.map(
                                  number => (
                                    <option
                                      key={number}
                                      value={number}
                                    >
                                      {number}
                                    </option>
                                  )
                                )}

                              </select>

                              {hasDuplicateEditItemNumber && (

                                <p className="text-[10px] text-red-600 mt-1">

                                  Already exists

                                </p>

                              )}

                            </div>

                          ) : (

                            <span className="text-sm font-semibold text-slate-800">

                              {item.item_number ||
                                '—'}

                            </span>

                          )}

                        </td>


                        {/* ITEM NAME */}

                        <td className="px-4 py-3">

                          {isEditingDetails ? (

                            <div>

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
                                className={`w-32 px-2 py-1 border rounded text-sm text-slate-800 focus:ring-1 focus:ring-teal-500 outline-none ${
                                  hasDuplicateEditItemName
                                    ? 'border-amber-400 bg-amber-50'
                                    : 'border-teal-400'
                                }`}
                              />


                              {hasDuplicateEditItemName && (

                                <p className="text-[10px] text-amber-600 mt-1">

                                  Duplicate name

                                </p>

                              )}

                            </div>

                          ) : (

                            <>

                              <p className={`text-sm font-medium ${
                                itemNameIsDuplicate
                                  ? 'text-amber-700'
                                  : 'text-slate-800'
                              }`}>

                                {item.item_name ||
                                  '—'}

                              </p>


                              {itemNameIsDuplicate && (

                                <p className="text-[10px] text-amber-600 mt-0.5">

                                  Duplicate name

                                </p>

                              )}


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


                        {/* ACTUAL PRICE */}

                        <td className="px-4 py-3 text-right">

                          {isEditingDetails ? (

                            <div className="relative">

                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">

                                ₹

                              </span>


                              <input
                                type="number"
                                value={
                                  editActualPrice
                                }
                                onChange={e =>
                                  setEditActualPrice(
                                    e.target.value
                                  )
                                }
                                min="0"
                                step="0.01"
                                placeholder="0"
                                className="w-24 pl-5 pr-2 py-1 border border-teal-400 rounded text-sm text-slate-800 focus:ring-1 focus:ring-teal-500 outline-none"
                              />

                            </div>

                          ) : (

                            <span className="text-sm text-slate-800">

                              {item.actual_price !== null &&
                              item.actual_price !== undefined &&
                              item.actual_price !== ''
                                ? `₹${Number(
                                    item.actual_price
                                  ).toLocaleString(
                                    'en-IN'
                                  )}`
                                : '—'}

                            </span>

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
                                placeholder="0"
                                className="w-24 pl-5 pr-2 py-1 border border-teal-400 rounded text-sm text-slate-800 focus:ring-1 focus:ring-teal-500 outline-none"
                              />

                            </div>

                          ) : (

                            <span className="text-sm text-slate-800 font-medium">

                              {item.amount !== null &&
                              item.amount !== undefined &&
                              item.amount !== ''
                                ? `₹${Number(
                                    item.amount
                                  ).toLocaleString(
                                    'en-IN'
                                  )}`
                                : '—'}

                            </span>

                          )}

                        </td>


                        {/* PAYMENT METHOD */}

                        <td className="px-4 py-3 text-center">

                          {isEditingDetails ? (

                            <select
                              value={
                                editPaymentMethod
                              }
                              onChange={e =>
                                setEditPaymentMethod(
                                  e.target.value as
                                    | 'Cash'
                                    | 'GPay'
                                    | 'Token'
                                    | 'Cash,Token'
                                    | 'GPay,Token'
                                    | 'GPay,Cash'
                                )
                              }
                              className="w-36 px-2 py-1 border border-teal-400 rounded text-sm text-slate-800 bg-white focus:ring-1 focus:ring-teal-500 outline-none"
                            >

                              <option value="Cash">
                                Cash
                              </option>

                              <option value="GPay">
                                GPay
                              </option>

                              <option value="Token">
                                Token
                              </option>

                              <option value="Cash,Token">
                                Cash, Token
                              </option>

                              <option value="GPay,Token">
                                GPay, Token
                              </option>

                              <option value="GPay,Cash">
                                GPay, Cash
                              </option>

                            </select>

                          ) : (

                            <span className="text-sm text-slate-700">

                              {item.payment_method ||
                                '—'}

                            </span>

                          )}

                        </td>


                        {/* STATUS */}

                        <td className="px-4 py-3 text-center">

                          {item.amount !== null &&
                          item.amount !== undefined &&
                          item.amount !== '' ? (

                            <button
                              type="button"
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

                          ) : (

                            <span className="text-xs text-slate-400">
                              —
                            </span>

                          )}

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
                                  value={
                                    editSettled
                                  }
                                  onChange={e =>
                                    setEditSettled(
                                      e.target.value
                                    )
                                  }
                                  min="0"
                                  max={
                                    Number(
                                      item.amount ||
                                      0
                                    )
                                  }
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

                                    setEditingId(
                                      null
                                    );

                                    setEditSettled(
                                      ''
                                    );

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
                                  item.amount ||
                                  0
                                ).toLocaleString(
                                  'en-IN'
                                )}

                              </span>

                            </div>

                          ) : (

                            <div className="flex flex-col items-end gap-1">

                              <span className="text-sm text-green-700 font-medium">

                                {item.settled_amount !== null &&
                                item.settled_amount !== undefined &&
                                item.settled_amount !== ''
                                  ? `₹${Number(
                                      item.settled_amount
                                    ).toLocaleString(
                                      'en-IN'
                                    )}`
                                  : '—'}

                              </span>


                              {item.amount !== null &&
                              item.amount !== undefined &&
                              item.amount !== '' && (

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

                              )}

                            </div>

                          )}

                        </td>


                        {/* PENDING */}

                        <td className="px-4 py-3 text-right">

                          {item.amount !== null &&
                          item.amount !== undefined &&
                          item.amount !== '' ? (

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

                          ) : (

                            <span className="text-sm text-slate-400">
                              —
                            </span>

                          )}

                        </td>


                        {/* REMARKS */}

                        <td className="px-4 py-3">

                          {isEditingDetails ? (

                            <input
                              type="text"
                              value={editRemarks}
                              onChange={e =>
                                setEditRemarks(e.target.value)
                              }
                              className="w-36 px-2 py-1 border border-teal-400 rounded text-sm text-slate-800 focus:ring-1 focus:ring-teal-500 outline-none"
                            />

                          ) : (

                            <span className="text-sm text-slate-700">
                              {item.remarks || '—'}
                            </span>

                          )}

                        </td>


                        {/* ACTIONS */}

                        <td className="px-4 py-3">

                          <div className="flex items-center justify-center gap-1">

                            {isEditingDetails ? (

                              <>

                                <button
                                  type="button"
                                  onClick={() =>
                                    saveEditDetails(
                                      item
                                    )
                                  }
                                  disabled={
                                    hasDuplicateEditItemNumber ||
                                    !editItemNumber.trim()
                                  }
                                  className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 disabled:opacity-40 transition-colors"
                                  title="Save changes"
                                >

                                  <Save className="w-3.5 h-3.5" />

                                </button>


                                <button
                                  type="button"
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
                                  type="button"
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
                                  type="button"
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




            </table>

          </div>

          </div>

      )}

    </div>

  );

}